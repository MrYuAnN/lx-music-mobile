package com.shiyin.music.crypto;

import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.KeySpec;
import java.security.spec.PKCS8EncodedKeySpec;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

public class CryptoModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext reactContext;

  CryptoModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "CryptoModule";
  }

  @ReactMethod
  public void generateRsaKey(Promise promise) {
    KeyPair kp = RSA.getKeyPair();
    String publicKeyBytesBase64 = new String(Base64.encode(kp.getPublic().getEncoded(), Base64.DEFAULT));

    KeyFactory keyFac;
    try {
      keyFac = KeyFactory.getInstance("RSA");
    } catch (NoSuchAlgorithmException e) {
      promise.reject("-1", e.toString());
      return;
    }
    KeySpec keySpec = new PKCS8EncodedKeySpec(kp.getPrivate().getEncoded());
    Key key;
    try {
      key = keyFac.generatePrivate(keySpec);
    } catch (InvalidKeySpecException e) {
      promise.reject("-1", e.toString());
      return;
    }
    String privateKeyBytesBase64 = new String(Base64.encode(key.getEncoded(), Base64.DEFAULT));
    WritableMap params = Arguments.createMap();
    params.putString("publicKey", publicKeyBytesBase64);
    params.putString("privateKey", privateKeyBytesBase64);
    promise.resolve(params);
  }

  @ReactMethod
  public void rsaEncrypt(String text, String key, String padding, Promise promise) {
    promise.resolve(RSA.encryptRSAToString(text, key, padding));
    //    TaskRunner taskRunner = new TaskRunner();
    //    try {
    //      taskRunner.executeAsync(new GzipModule.UnGzip(source, target, force), (String errMessage) -> {
    //        if ("".equals(errMessage)) {
    //          promise.resolve(null);
    //        } else promise.reject("-2", errMessage);
    //      });
    //    } catch (RuntimeException err) {
    //      promise.reject("-2", err.getMessage());
    //    }
  }

  @ReactMethod
  public void rsaDecrypt(String text, String key, String padding, Promise promise) {
    promise.resolve(RSA.decryptRSAToString(text, key, padding));
    //    TaskRunner taskRunner = new TaskRunner();
    //    try {
    //      taskRunner.executeAsync(new GzipModule.UnGzip(source, target, force), (String errMessage) -> {
    //        if ("".equals(errMessage)) {
    //          promise.resolve(null);
    //        } else promise.reject("-2", errMessage);
    //      });
    //    } catch (RuntimeException err) {
    //      promise.reject("-2", err.getMessage());
    //    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  public String rsaEncryptSync(String text, String key, String padding) {
    return RSA.encryptRSAToString(text, key, padding);
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  public String rsaDecryptSync(String text, String key, String padding) {
    return RSA.decryptRSAToString(text, key, padding);
  }

  @ReactMethod
  public void aesEncrypt(String text, String key, String iv, String mode, Promise promise) {
    promise.resolve(AES.encrypt(text, key, iv, mode));
    //    TaskRunner taskRunner = new TaskRunner();
    //    try {
    //      taskRunner.executeAsync(new GzipModule.UnGzip(source, target, force), (String errMessage) -> {
    //        if ("".equals(errMessage)) {
    //          promise.resolve(null);
    //        } else promise.reject("-2", errMessage);
    //      });
    //    } catch (RuntimeException err) {
    //      promise.reject("-2", err.getMessage());
    //    }
  }

  @ReactMethod
  public void aesDecrypt(String text, String key, String iv, String mode, Promise promise) {
    promise.resolve(AES.decrypt(text, key, iv, mode));
    //    TaskRunner taskRunner = new TaskRunner();
    //    try {
    //      taskRunner.executeAsync(new GzipModule.UnGzip(source, target, force), (String errMessage) -> {
    //        if ("".equals(errMessage)) {
    //          promise.resolve(null);
    //        } else promise.reject("-2", errMessage);
    //      });
    //    } catch (RuntimeException err) {
    //      promise.reject("-2", err.getMessage());
    //    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  public String aesEncryptSync(String text, String key, String iv, String mode) {
    return AES.encrypt(text, key, iv, mode);
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  public String aesDecryptSync(String text, String key, String iv, String mode) {
    return AES.decrypt(text, key, iv, mode);
  }

  @ReactMethod
  public void sha1(String input, Promise promise) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-1");
      byte[] messageDigest = md.digest(input.getBytes("UTF-8"));

      StringBuilder hexString = new StringBuilder();
      for (byte b : messageDigest) {
        String hex = Integer.toHexString(0xFF & b);
        if (hex.length() == 1) {
          hexString.append('0');
        }
        hexString.append(hex);
      }

      promise.resolve(hexString.toString());
    } catch (Exception e) {
      promise.reject("SHA1_ERROR", "哈希计算失败", e);
    }
  }

  // ⑦b 下载文件独占（2026-11-01 拍板 A+头加密）：私有目录+.shy 扩展名双隔离之上，文件头
  // 16B AES-ECB 单块混淆破坏音频魔数——改回扩展名也无法直接播放。幂等判别=明文头含已知
  // 音频魔数（ID3/fLaC/OggS/ftyp(m4a)/RIFF(wav)/裸 MPEG 帧 0xFFEx）；key 为产品固定值
  // （APK 内可提取，安全等级=防直接播放的混淆层，独占主要由私有目录+扩展名承担）
  private static final byte[] HDR_KEY = "shiyin@hdr#2026!".getBytes(StandardCharsets.US_ASCII);
  private static final byte[][] HDR_MAGICS = {
      "ID3".getBytes(StandardCharsets.US_ASCII),          // mp3（ID3v2）
      "fLaC".getBytes(StandardCharsets.US_ASCII),         // flac
      "OggS".getBytes(StandardCharsets.US_ASCII),         // ogg
      "ftyp".getBytes(StandardCharsets.US_ASCII),         // m4a/mp4（box 偏移 4）
      "RIFF".getBytes(StandardCharsets.US_ASCII),         // wav
  };

  /** 明文头判别：含已知魔数或裸 MPEG 帧同步字 0xFFEx（无 ID3 的裸 mp3） */
  private static boolean looksLikeAudio(byte[] h) {
    for (byte[] magic : HDR_MAGICS) {
      int off = (new String(magic, StandardCharsets.US_ASCII).equals("ftyp")) ? 4 : 0;
      if (h.length >= off + magic.length) {
        boolean hit = true;
        for (int i = 0; i < magic.length; i++) {
          if (h[off + i] != magic[i]) { hit = false; break; }
        }
        if (hit) return true;
      }
    }
    return h.length >= 2 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xE0) == 0xE0;
  }

  /** 单点变换（RandomAccessFile offset 读写 16B；AES-ECB 单块无 padding） */
  private static void xorHeaderBlock(String path, boolean encrypt, Promise promise) {
    try (RandomAccessFile f = new RandomAccessFile(path, "rw")) {
      if (f.length() < 16) { promise.resolve(false); return; }
      byte[] head = new byte[16];
      f.seek(0);
      f.readFully(head);
      boolean plain = looksLikeAudio(head);
      if (encrypt == plain) { promise.resolve(false); return; } // 幂等：目标态已达成
      Cipher c = Cipher.getInstance("AES/ECB/NoPadding");
      c.init(encrypt ? Cipher.ENCRYPT_MODE : Cipher.DECRYPT_MODE, new SecretKeySpec(HDR_KEY, "AES"));
      byte[] out = c.doFinal(head);
      f.seek(0);
      f.write(out);
      promise.resolve(true);
    } catch (Exception e) {
      promise.reject("HDR_ERROR", e.getMessage(), e);
    }
  }

  /** 混淆文件头（明→暗；已暗=幂等跳过 resolve(false)）。下载完成链调用 */
  @ReactMethod
  public void obfuscateFileHeader(String path, Promise promise) {
    xorHeaderBlock(path, true, promise);
  }

  /** 还原文件头（暗→明；已明=幂等跳过 resolve(false)）。播放前调用（私有目录+.shy 下明头暴露面可控） */
  @ReactMethod
  public void restoreFileHeader(String path, Promise promise) {
    xorHeaderBlock(path, false, promise);
  }

}

