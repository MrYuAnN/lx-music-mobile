// import { createCipheriv, createDecipheriv, publicEncrypt, privateDecrypt, constants } from 'crypto'
import { aesEncryptSync, aesDecryptSync, rsaEncryptSync, rsaDecryptSync, AES_MODE, RSA_PADDING } from '@/utils/nativeModules/crypto'
import { fromByteArray } from 'react-native-quick-base64'

// N2：quick-base64 3.x 移除 btoa 导出。原 btoa 为 UTF-8 安全版（非标准 latin1 语义），
// 用 fromByteArray + UTF-8 字节等价重写（Buffer 是 Uint8Array 子类），加密输入语义不变。
// as Buffer：tsc 全绿；typescript-eslint 6.21 对 Buffer.from 泛型重载误判 any，显式断言断链（栈升级另行排期）
const btoa = (text: string) => fromByteArray(Buffer.from(text, 'utf8') as Buffer)

export const aesEncrypt = (text: string, b64Key: string) => {
  // const cipher = createCipheriv('aes-128-ecb', Buffer.from(key, 'base64'), '')
  // return Buffer.concat([cipher.update(Buffer.from(text)), cipher.final()]).toString('base64')
  return aesEncryptSync(btoa(text), b64Key, '', AES_MODE.ECB_128_NoPadding)
}

export const aesDecrypt = (text: string, b64Key: string) => {
  // const decipher = createDecipheriv('aes-128-ecb', Buffer.from(key, 'base64'), '')
  // return Buffer.concat([decipher.update(Buffer.from(text, 'base64')), decipher.final()]).toString()
  return aesDecryptSync(text, b64Key, '', AES_MODE.ECB_128_NoPadding)
}

export const rsaEncrypt = (buffer: Buffer, key: string): string => {
  // return publicEncrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING }, buffer).toString('base64')
  return rsaEncryptSync(buffer.toString('base64'), key, RSA_PADDING.OAEPWithSHA1AndMGF1Padding)
}
export const rsaDecrypt = (buffer: Buffer, key: string): string => {
  // return privateDecrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING }, buffer)
  return rsaDecryptSync(buffer.toString('base64'), key, RSA_PADDING.OAEPWithSHA1AndMGF1Padding)
}
