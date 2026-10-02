import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

class WidgetScreenshotCapturer {
  /// Renders any Flutter widget tree directly in memory into high-resolution PNG bytes.
  /// This completely bypasses onscreen rasterization occlusion and avoids `!debugNeedsPaint` assertion issues.
  static Future<Uint8List> captureWidget({
    required Widget widget,
    double targetWidth = 520,
    double pixelRatio = 2.5,
    Duration waitDuration = const Duration(milliseconds: 20),
  }) async {
    final repaintBoundary = RenderRepaintBoundary();
    final view = WidgetsBinding.instance.platformDispatcher.views.first;

    final renderView = RenderView(
      view: view,
      child: RenderPositionedBox(
        alignment: Alignment.center,
        child: repaintBoundary,
      ),
      configuration: ViewConfiguration(
        logicalConstraints: BoxConstraints(
          minWidth: targetWidth,
          maxWidth: targetWidth,
          minHeight: 0,
          maxHeight: double.infinity,
        ),
        devicePixelRatio: pixelRatio,
      ),
    );

    final pipelineOwner = PipelineOwner();
    final buildOwner = BuildOwner(focusManager: FocusManager());

    pipelineOwner.rootNode = renderView;
    renderView.prepareInitialFrame();

    final rootElement = RenderObjectToWidgetAdapter<RenderBox>(
      container: repaintBoundary,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Material(
          color: Colors.white,
          child: widget,
        ),
      ),
    ).attachToRenderTree(buildOwner);

    buildOwner.buildScope(rootElement);
    buildOwner.finalizeTree();

    pipelineOwner.flushLayout();
    pipelineOwner.flushCompositingBits();
    pipelineOwner.flushPaint();

    if (waitDuration > Duration.zero) {
      await Future.delayed(waitDuration);
    }

    final ui.Image image = await repaintBoundary.toImage(pixelRatio: pixelRatio);
    final ByteData? byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    if (byteData == null) {
      throw Exception('Gagal mengonversi gambar laporan ke format PNG.');
    }

    return byteData.buffer.asUint8List();
  }
}
