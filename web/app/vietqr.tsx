'use client'
import { useMemo, useState } from 'react'
import QRCode from 'qrcode'

export const VIETQR_BANKS: [string, string][] = [
  ['970422', 'MBBank (970422)'],
  ['970436', 'Vietcombank (970436)'],
  ['970407', 'Techcombank (970407)'],
  ['970418', 'BIDV (970418)'],
  ['970415', 'VietinBank (970415)'],
  ['970416', 'ACB (970416)'],
  ['970432', 'VPBank (970432)'],
  ['970423', 'TPBank (970423)'],
  ['970403', 'Sacombank (970403)'],
  ['970405', 'Agribank (970405)'],
  ['970441', 'VIB (970441)'],
  ['970437', 'HDBank (970437)'],
  ['970448', 'OCB (970448)'],
  ['970426', 'MSB (970426)'],
]

const bankNames = new Map(VIETQR_BANKS)

function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value
}

function toAscii(text: string, maxLen: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .replace(/[^A-Za-z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLen)
}

function crc16Ccitt(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function buildVietQrPayload(params: {
  bankBin: string
  bankAccountNo: string
  amount: number
  note: string
}): string {
  const bin = params.bankBin.replace(/\D/g, '')
  const accountNo = params.bankAccountNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const roundedAmount = Math.max(0, Math.round(params.amount))
  const cleanNote = toAscii(params.note, 50)

  const beneficiary = tlv('00', bin) + tlv('01', accountNo)
  const napasAccount = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA')

  let payload =
    tlv('00', '01') +
    tlv('01', roundedAmount > 0 ? '12' : '11') +
    tlv('38', napasAccount) +
    tlv('53', '704')

  if (roundedAmount > 0) payload += tlv('54', String(roundedAmount))
  payload += tlv('58', 'VN')
  if (cleanNote) payload += tlv('62', tlv('08', cleanNote))

  payload += '6304'
  return payload + crc16Ccitt(payload)
}

export function VietQrBox({
  bankBin,
  bankAccountNo,
  bankAccountName,
  amount,
  roomCode,
  billingPeriod,
}: {
  bankBin?: string | null
  bankAccountNo?: string | null
  bankAccountName?: string | null
  amount: number
  roomCode: string
  billingPeriod: string
}) {
  const [copied, setCopied] = useState('')
  const transferNote = toAscii(`RF ${roomCode} ${billingPeriod}`, 50)
  const moneyText = new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ'

  const qrSvg = useMemo(() => {
    if (!bankBin || !bankAccountNo || amount <= 0) return null
    try {
      const payload = buildVietQrPayload({ bankBin, bankAccountNo, amount, note: transferNote })
      const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' })
      const size = qr.modules.size
      const margin = 2
      const parts: string[] = []
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (qr.modules.get(r, c)) {
            parts.push(`M${c + margin} ${r + margin}h1v1h-1z`)
          }
        }
      }
      return { total: size + margin * 2, path: parts.join('') }
    } catch {
      return null
    }
  }, [bankBin, bankAccountNo, amount, transferNote])

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      setCopied('')
    }
  }

  if (!bankBin || !bankAccountNo) {
    return (
      <div className="vietqr-box">
        <p className="vietqr-empty">
          Chưa cấu hình tài khoản ngân hàng VietQR cho khu trọ này (Chủ trọ thiết lập tại mục <strong>Khu trọ &amp; phòng → Cài đặt VietQR nhận tiền</strong>).
        </p>
      </div>
    )
  }

  return (
    <div className="vietqr-box">
      <div className="vietqr-qr">
        {qrSvg ? (
          <svg
            viewBox={`0 0 ${qrSvg.total} ${qrSvg.total}`}
            width={180}
            height={180}
            role="img"
            aria-label={`Mã VietQR hóa đơn phòng ${roomCode} kỳ ${billingPeriod}`}
            shapeRendering="crispEdges"
          >
            <rect width={qrSvg.total} height={qrSvg.total} fill="#ffffff" />
            <path d={qrSvg.path} fill="#000000" />
          </svg>
        ) : (
          <p>Không tạo được mã QR.</p>
        )}
      </div>
      <div className="vietqr-info">
        <h4>Chuyển khoản nhanh VietQR (NAPAS 247)</h4>
        <p><strong>Ngân hàng:</strong> {bankNames.get(bankBin) ?? bankBin}</p>
        <p>
          <strong>Số tài khoản:</strong> <code>{bankAccountNo}</code>{' '}
          <button type="button" className="ghost no-print" onClick={() => copyText('STK', bankAccountNo)}>
            {copied === 'STK' ? 'Đã chép' : 'Chép STK'}
          </button>
        </p>
        {bankAccountName && <p><strong>Chủ tài khoản:</strong> {bankAccountName}</p>}
        <p><strong>Số tiền cần chuyển:</strong> <strong>{moneyText}</strong></p>
        <p>
          <strong>Nội dung CK:</strong> <code>{transferNote}</code>{' '}
          <button type="button" className="ghost no-print" onClick={() => copyText('ND', transferNote)}>
            {copied === 'ND' ? 'Đã chép' : 'Chép nội dung'}
          </button>
        </p>
        <p className="vietqr-hint no-print">
          Quét mã bằng ứng dụng ngân hàng, sau khi chuyển khoản bấm <strong>Báo thanh toán → Chuyển khoản</strong> bên dưới để chủ trọ/kế toán đối soát xác nhận.
        </p>
      </div>
    </div>
  )
}