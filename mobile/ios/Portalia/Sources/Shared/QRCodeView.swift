import SwiftUI
import CoreImage.CIFilterBuiltins

struct QRCodeView: View {
    let payload: String

    var body: some View {
        if let image = Self.generate(from: payload) {
            Image(uiImage: image)
                .interpolation(.none)
                .resizable()
                .frame(width: 180, height: 180)
        } else {
            Rectangle()
                .fill(Theme.border)
                .frame(width: 180, height: 180)
        }
    }

    private static func generate(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let outputImage = filter.outputImage else { return nil }
        let scaled = outputImage.transformed(by: CGAffineTransform(scaleX: 8, y: 8))
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
