package com.portalia.app.ui.shared

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter

/** Gera o QR localmente com ZXing — mesma ideia do CIFilter.qrCodeGenerator do iOS, sem precisar de rede. */
@Composable
fun QrCodeImage(payload: String, modifier: Modifier = Modifier.size(180.dp)) {
    val bitmap = remember(payload) { generateQrBitmap(payload, 512) }
    Image(bitmap = bitmap.asImageBitmap(), contentDescription = "QR code", modifier = modifier)
}

private fun generateQrBitmap(payload: String, size: Int): Bitmap {
    val matrix = QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, size, size)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
    for (x in 0 until size) {
        for (y in 0 until size) {
            bitmap.setPixel(x, y, if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
        }
    }
    return bitmap
}
