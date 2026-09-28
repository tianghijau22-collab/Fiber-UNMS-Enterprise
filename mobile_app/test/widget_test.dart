import 'package:flutter_test/flutter_test.dart';
import 'package:fiber_unms_mobile/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const FiberUnmsApp());
  });
}
