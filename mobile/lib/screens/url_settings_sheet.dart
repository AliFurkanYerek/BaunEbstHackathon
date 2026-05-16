import 'package:flutter/material.dart';

Future<String?> showUrlSettingsSheet(
  BuildContext context, {
  required String currentUrl,
}) {
  final controller = TextEditingController(text: currentUrl);
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) {
      final bottom = MediaQuery.viewInsetsOf(ctx).bottom;
      return Padding(
        padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Sunucu adresi',
              style: Theme.of(ctx).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Geliştirme: bilgisayarınızda `npm run dev` çalışırken '
              'yerel IP ve port (ör. http://192.168.1.5:5173). '
              'Emülatör Android için 10.0.2.2:5173 kullanılır.',
              style: Theme.of(ctx).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'WEB_APP_URL',
                border: OutlineInputBorder(),
                hintText: 'http://192.168.1.5:5173',
              ),
              keyboardType: TextInputType.url,
              autocorrect: false,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                final url = controller.text.trim();
                if (url.isEmpty) return;
                Navigator.pop(ctx, url);
              },
              child: const Text('Kaydet ve yenile'),
            ),
          ],
        ),
      );
    },
  );
}
