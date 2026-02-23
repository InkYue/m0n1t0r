const TS_PACKET_SIZE: usize = 188;
const SYNC_BYTE: u8 = 0x47;
const PAT_PID: u16 = 0x0000;
const PMT_PID: u16 = 0x1000;
const VIDEO_PID: u16 = 0x0100;

fn crc32_mpeg2(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFF_FFFF;
    for &byte in data {
        crc ^= (byte as u32) << 24;
        for _ in 0..8 {
            if crc & 0x8000_0000 != 0 {
                crc = (crc << 1) ^ 0x04C1_1DB7;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

pub struct TsMuxer {
    pat_cc: u8,
    pmt_cc: u8,
    video_cc: u8,
}

impl TsMuxer {
    pub fn new() -> Self {
        Self {
            pat_cc: 0,
            pmt_cc: 0,
            video_cc: 0,
        }
    }

    pub fn generate_header(&mut self) -> Vec<u8> {
        let mut result = Vec::with_capacity(TS_PACKET_SIZE * 2);
        result.extend_from_slice(&self.generate_pat());
        result.extend_from_slice(&self.generate_pmt());
        result
    }

    fn generate_pat(&mut self) -> [u8; TS_PACKET_SIZE] {
        let mut pkt = [0xFF; TS_PACKET_SIZE];
        pkt[0] = SYNC_BYTE;
        pkt[1] = 0x40;
        pkt[2] = (PAT_PID & 0xFF) as u8;
        pkt[3] = 0x10 | (self.pat_cc & 0x0F);
        self.pat_cc = (self.pat_cc + 1) & 0x0F;

        // Pointer field
        pkt[4] = 0x00;

        // PAT section: table_id=0, section_length=13
        let s = 5;
        pkt[s] = 0x00;
        pkt[s + 1] = 0xB0;
        pkt[s + 2] = 0x0D;
        pkt[s + 3] = 0x00;
        pkt[s + 4] = 0x01; // transport_stream_id = 1
        pkt[s + 5] = 0xC1; // version=0, current_next=1
        pkt[s + 6] = 0x00; // section_number
        pkt[s + 7] = 0x00; // last_section_number
        // program_number=1 -> PMT_PID
        pkt[s + 8] = 0x00;
        pkt[s + 9] = 0x01;
        pkt[s + 10] = 0xE0 | ((PMT_PID >> 8) as u8 & 0x1F);
        pkt[s + 11] = (PMT_PID & 0xFF) as u8;

        let crc = crc32_mpeg2(&pkt[s..s + 12]);
        pkt[s + 12] = ((crc >> 24) & 0xFF) as u8;
        pkt[s + 13] = ((crc >> 16) & 0xFF) as u8;
        pkt[s + 14] = ((crc >> 8) & 0xFF) as u8;
        pkt[s + 15] = (crc & 0xFF) as u8;

        pkt
    }

    fn generate_pmt(&mut self) -> [u8; TS_PACKET_SIZE] {
        let mut pkt = [0xFF; TS_PACKET_SIZE];
        pkt[0] = SYNC_BYTE;
        pkt[1] = 0x40 | ((PMT_PID >> 8) as u8 & 0x1F);
        pkt[2] = (PMT_PID & 0xFF) as u8;
        pkt[3] = 0x10 | (self.pmt_cc & 0x0F);
        self.pmt_cc = (self.pmt_cc + 1) & 0x0F;

        pkt[4] = 0x00;

        // PMT section: table_id=2, section_length=18
        let s = 5;
        pkt[s] = 0x02;
        pkt[s + 1] = 0xB0;
        pkt[s + 2] = 0x12;
        pkt[s + 3] = 0x00;
        pkt[s + 4] = 0x01; // program_number = 1
        pkt[s + 5] = 0xC1;
        pkt[s + 6] = 0x00;
        pkt[s + 7] = 0x00;
        // PCR_PID = VIDEO_PID
        pkt[s + 8] = 0xE0 | ((VIDEO_PID >> 8) as u8 & 0x1F);
        pkt[s + 9] = (VIDEO_PID & 0xFF) as u8;
        pkt[s + 10] = 0xF0;
        pkt[s + 11] = 0x00; // program_info_length = 0
        // stream: type=0x01 (MPEG1 video), PID=VIDEO_PID
        pkt[s + 12] = 0x01;
        pkt[s + 13] = 0xE0 | ((VIDEO_PID >> 8) as u8 & 0x1F);
        pkt[s + 14] = (VIDEO_PID & 0xFF) as u8;
        pkt[s + 15] = 0xF0;
        pkt[s + 16] = 0x00; // ES_info_length = 0

        let crc = crc32_mpeg2(&pkt[s..s + 17]);
        pkt[s + 17] = ((crc >> 24) & 0xFF) as u8;
        pkt[s + 18] = ((crc >> 16) & 0xFF) as u8;
        pkt[s + 19] = ((crc >> 8) & 0xFF) as u8;
        pkt[s + 20] = (crc & 0xFF) as u8;

        pkt
    }

    pub fn mux_video(&mut self, data: &[u8], pts_90k: u64) -> Vec<u8> {
        let mut pes = Vec::with_capacity(data.len() + 14);

        // PES start code + video stream_id
        pes.extend_from_slice(&[0x00, 0x00, 0x01, 0xE0]);

        // PES packet length (0 = unbounded for video when > 65535)
        let pes_payload_len = 3 + 5 + data.len();
        if pes_payload_len <= 65535 {
            pes.push(((pes_payload_len >> 8) & 0xFF) as u8);
            pes.push((pes_payload_len & 0xFF) as u8);
        } else {
            pes.extend_from_slice(&[0x00, 0x00]);
        }

        // PES header flags: marker=10, PTS present
        pes.push(0x80);
        pes.push(0x80);
        pes.push(0x05); // header data length = 5 (PTS)

        // PTS (5 bytes, 33-bit value in 90kHz)
        pes.push(0x21 | (((pts_90k >> 29) & 0x0E) as u8));
        pes.push(((pts_90k >> 22) & 0xFF) as u8);
        pes.push((((pts_90k >> 14) & 0xFE) | 0x01) as u8);
        pes.push(((pts_90k >> 7) & 0xFF) as u8);
        pes.push((((pts_90k << 1) & 0xFE) | 0x01) as u8);

        pes.extend_from_slice(data);

        self.packetize(&pes)
    }

    fn packetize(&mut self, data: &[u8]) -> Vec<u8> {
        let num_packets = data.len().div_ceil(184);
        let mut result = Vec::with_capacity(num_packets * TS_PACKET_SIZE);
        let mut offset = 0;
        let mut first = true;

        while offset < data.len() {
            let mut pkt = [0xFF; TS_PACKET_SIZE];
            pkt[0] = SYNC_BYTE;
            pkt[1] = (VIDEO_PID >> 8) as u8 & 0x1F;
            pkt[2] = (VIDEO_PID & 0xFF) as u8;
            if first {
                pkt[1] |= 0x40; // PUSI
                first = false;
            }

            let remaining = data.len() - offset;

            if remaining >= 184 {
                pkt[3] = 0x10 | (self.video_cc & 0x0F);
                pkt[4..].copy_from_slice(&data[offset..offset + 184]);
                offset += 184;
            } else if remaining == 183 {
                pkt[3] = 0x30 | (self.video_cc & 0x0F);
                pkt[4] = 0x00;
                pkt[5..].copy_from_slice(&data[offset..offset + 183]);
                offset += 183;
            } else {
                pkt[3] = 0x30 | (self.video_cc & 0x0F);
                let af_len = 183 - remaining;
                pkt[4] = af_len as u8;
                if af_len >= 1 {
                    pkt[5] = 0x00; // adaptation field flags
                }
                // bytes 6..5+af_len stay 0xFF (stuffing)
                let payload_start = 5 + af_len;
                pkt[payload_start..payload_start + remaining]
                    .copy_from_slice(&data[offset..offset + remaining]);
                offset += remaining;
            }

            self.video_cc = (self.video_cc + 1) & 0x0F;
            result.extend_from_slice(&pkt);
        }

        result
    }
}
