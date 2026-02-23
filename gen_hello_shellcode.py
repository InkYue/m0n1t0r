#!/usr/bin/env python3
"""
Windows x64 MessageBoxW(L"你好") shellcode generator.
Technique: LDR name-hash kernel32 detection -> LoadLibraryA(user32) -> MessageBoxW
- Robust kernel32 detection via LDR name hash (works on Win10/11)
- Ends with RET (caller-safe, works with voidgate spawned thread)
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
    """ROR13 hash of ASCII export name."""
    h = 0
    for c in name:
        h = ror32(h, 13)
        h = (h + ord(c)) & 0xFFFFFFFF
    return h


K32_HASH     = module_hash("kernel32.dll")
LOADLIB_HASH = api_hash("LoadLibraryA")
MSGBOX_HASH  = api_hash("MessageBoxW")

print(f"kernel32.dll hash : 0x{K32_HASH:08X}")
print(f"LoadLibraryA hash : 0x{LOADLIB_HASH:08X}")
print(f"MessageBoxW  hash : 0x{MSGBOX_HASH:08X}")

ASM = f"""\
BITS 64

; Windows x64 shellcode - MessageBoxW(NULL, L nihao, L m0n1t0r, MB_OK)
; Finds kernel32 by LDR module name hash (robust on Win10/11).
; Ends with RET - safe for voidgate-spawned threads.

; Stack frame layout after prologue alignment:
;
;   rsp+0x00..0x1F : shadow space 32 bytes for all calls
;   rsp+0x20..0x2F : user32.dll slot 16 bytes for LoadLibraryA
;   rsp+0x30..0x37 : nihao UTF-16 slot 8 bytes for MessageBoxW lpText
;   rsp+0x38..0x47 : m0n1t0r UTF-16 slot 16 bytes for MessageBoxW lpCaption
;   rsp+0x48..0x4F : padding 8 bytes keeps rsp 16-byte aligned
;
; Total 0x50 = 80 bytes, 0x50 mod 16 = 0, rsp is 16-byte aligned before every call.
; Each call pushes retaddr so inside the callee:
;   new_rsp+0x08 = string slot, new_rsp+0x10..0x27 = shadow space

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

    mov  rbp, rsp
    and  rsp, -16
    sub  rsp, 0x50              ; one allocation covers shadow + all string slots + alignment padding

    ; --- find kernel32 by LDR module name hash ---
    mov  r15d, 0x{K32_HASH:08X}
    call find_kernel32
    mov  r14, rax               ; r14 = kernel32 base

    ; --- find LoadLibraryA in kernel32 ---
    mov  r15d, 0x{LOADLIB_HASH:08X}
    call find_export
    mov  r12, rax               ; r12 = LoadLibraryA

    ; --- LoadLibraryA(user32.dll) ---
    ; write user32.dll into slot at rsp+0x20
    mov  dword [rsp+0x20], 0x72657375   ; user
    mov  dword [rsp+0x24], 0x642E3233   ; 32.d
    mov  dword [rsp+0x28], 0x006C6C     ; ll + null
    lea  rcx, [rsp+0x20]                ; arg1 = lpLibFileName
    call r12
    mov  r14, rax               ; r14 = user32 base

    ; --- find MessageBoxW in user32 ---
    mov  r15d, 0x{MSGBOX_HASH:08X}
    call find_export
    mov  r13, rax               ; r13 = MessageBoxW

    ; --- MessageBoxW(NULL, nihao, m0n1t0r, MB_OK) ---
    ; write nihao UTF-16 into slot at rsp+0x30
    mov  word [rsp+0x30], 0x4F60        ; U+4F60 ni
    mov  word [rsp+0x32], 0x597D        ; U+597D hao
    mov  word [rsp+0x34], 0x0000        ; null terminator
    lea  rdx, [rsp+0x30]                ; arg2 = lpText

    ; write m0n1t0r UTF-16 into slot at rsp+0x38
    mov  word [rsp+0x38], 0x006D        ; m
    mov  word [rsp+0x3A], 0x0030        ; 0
    mov  word [rsp+0x3C], 0x006E        ; n
    mov  word [rsp+0x3E], 0x0031        ; 1
    mov  word [rsp+0x40], 0x0074        ; t
    mov  word [rsp+0x42], 0x0030        ; 0
    mov  word [rsp+0x44], 0x0072        ; r
    mov  word [rsp+0x46], 0x0000        ; null
    lea  r8,  [rsp+0x38]                ; arg3 = lpCaption

    xor  rcx, rcx               ; arg1 = hWnd = NULL
    xor  r9d, r9d               ; arg4 = uType = MB_OK
    call r13

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
    jz   .fe_not_found
    lea  rdx, [r14 + rdx]       ; export directory VA

    mov  ecx, [rdx + 0x18]      ; NumberOfNames
    test ecx, ecx
    jz   .fe_not_found

    mov  r8d,  [rdx + 0x20]     ; AddressOfNames RVA
    lea  r8,   [r14 + r8]

    xor  r9, r9                 ; name index = 0

.fe_search:
    cmp  r9d, ecx
    jge  .fe_not_found

    mov  eax, [r8 + r9*4]
    lea  rsi, [r14 + rax]       ; name VA

    xor  edi, edi
.fe_hash:
    xor  eax, eax
    lodsb
    test al, al
    jz   .fe_hash_done
    ror  edi, 13
    add  edi, eax
    jmp  .fe_hash
.fe_hash_done:
    cmp  edi, r15d
    je   .fe_found

    inc  r9
    jmp  .fe_search

.fe_found:
    mov  r10d, [rdx + 0x24]     ; AddressOfNameOrdinals RVA
    lea  r10,  [r14 + r10]
    movzx eax, word [r10 + r9*2]

    mov  r10d, [rdx + 0x1c]     ; AddressOfFunctions RVA
    lea  r10,  [r14 + r10]
    mov  eax,  [r10 + rax*4]    ; function RVA
    lea  rax,  [r14 + rax]      ; function VA
    jmp  .fe_done

.fe_not_found:
    xor  rax, rax

.fe_done:
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
    asm_out = "hello_shellcode.asm"
    with open(asm_out, "w") as f:
        f.write(ASM)
    print(f"\nnasm not found. Install: brew install nasm")
    print(f"Assembly source saved to: {asm_out}")
    print(f"Then run: nasm -f bin {asm_out} -o hello.bin")
    sys.exit(1)

KEY = "0721"
encrypted = bytearray(shellcode)
kb = KEY.encode()
for i in range(len(encrypted)):
    encrypted[i] ^= kb[i % len(kb)]
shellcode = bytes(encrypted)

out = "hello.bin"
with open(out, "wb") as f:
    f.write(shellcode)

print(f"\nShellcode written to: {out}  ({len(shellcode)} bytes, encrypted with key '{KEY}')")
print(f"ep_offset : 0")
print(f"key       : {KEY}")
