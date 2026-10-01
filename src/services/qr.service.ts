import QRCode from 'qrcode';
import { generateSerial } from '../utils/generateSerial';
import { signSerial, buildQrUrl, verifySerialSignature } from '../utils/hmacSign';
import { ApiError } from '../utils/ApiError';

export interface GeneratedSerial {
  serialNumber: string;
  qrSignature: string;
  qrUrl: string;
}

export class QrService {
  /** Generate a fresh serial + signature + URL. Does NOT create a PNG. */
  static generateSerialOnly(): GeneratedSerial {
    const serialNumber = generateSerial();
    const qrSignature = signSerial(serialNumber);
    const qrUrl = buildQrUrl(serialNumber);
    return { serialNumber, qrSignature, qrUrl };
  }

  /** Generate a serial + its QR PNG buffer. */
  static async generateSerialWithPng(): Promise<GeneratedSerial & { png: Buffer }> {
    const base = this.generateSerialOnly();
    const png = await QRCode.toBuffer(base.qrUrl, {
      type: 'png',
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    return { ...base, png };
  }

  /** Assert the given signature matches both the recomputed HMAC and the stored one. */
  static assertValidSignature(serialNumber: string, givenSig: string, storedSig: string): void {
    if (!givenSig || !verifySerialSignature(serialNumber, givenSig) || givenSig !== storedSig) {
      throw ApiError.badRequest(
        'QR_INVALID_SIGNATURE',
        'This QR is not from QR CashBack Connect'
      );
    }
  }
}
