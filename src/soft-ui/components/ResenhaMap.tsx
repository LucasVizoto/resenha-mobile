import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

type Props = {
  latitude: number;
  longitude: number;
  height?: number;
  interactive?: boolean;
  pinDraggable?: boolean;
  /** Recentrar o mapa (busca / GPS). Não usar a cada arraste do pin. */
  cameraKey?: string | number;
  onChange?: (coords: { latitude: number; longitude: number }) => void;
  onPress?: () => void;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  style?: ViewStyle;
};

type MapMessage =
  | { type: 'move'; latitude: number; longitude: number }
  | { type: 'press' }
  | { type: 'touchstart' }
  | { type: 'touchend' };

export function ResenhaMap({
  latitude,
  longitude,
  height = 280,
  interactive = true,
  pinDraggable = false,
  cameraKey,
  onChange,
  onPress,
  onTouchStart,
  onTouchEnd,
  style,
}: Props) {
  const webRef = useRef<WebView>(null);
  const start = useRef({ latitude, longitude });
  const coordsRef = useRef({ latitude, longitude });
  coordsRef.current = { latitude, longitude };

  const canEdit = Boolean(onChange);
  const html = useMemo(
    () =>
      buildLeafletHtml({
        latitude: start.current.latitude,
        longitude: start.current.longitude,
        interactive,
        pinDraggable,
        editable: canEdit,
      }),
    [canEdit, interactive, pinDraggable],
  );

  const injectCamera = useCallback((lat: number, lng: number, animate: boolean) => {
    webRef.current?.injectJavaScript(
      `window.__resenhaSetView && window.__resenhaSetView(${lat},${lng},${animate ? 'true' : 'false'}); true;`,
    );
  }, []);

  useEffect(() => {
    if (cameraKey === undefined) return;
    injectCamera(coordsRef.current.latitude, coordsRef.current.longitude, true);
  }, [cameraKey, injectCamera]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as MapMessage;
      if (data.type === 'touchstart') {
        onTouchStart?.();
        return;
      }
      if (data.type === 'touchend') {
        onTouchEnd?.();
        return;
      }
      if (data.type === 'press') {
        onPress?.();
        return;
      }
      if (data.type === 'move' && onChange) {
        if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) return;
        onChange({ latitude: data.latitude, longitude: data.longitude });
      }
    } catch {
      // ignore
    }
  };

  return (
    <View
      collapsable={false}
      style={[styles.wrap, { height }, style]}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://unpkg.com/' }}
        style={styles.map}
        onMessage={onMessage}
        onLoadEnd={() => {
          injectCamera(coordsRef.current.latitude, coordsRef.current.longitude, false);
        }}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        nestedScrollEnabled
        scrollEnabled={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        startInLoadingState
      />
    </View>
  );
}

export const FALLBACK_COORDS = {
  latitude: -23.5505,
  longitude: -46.6333,
};

export const isNativeMapSupported = Platform.OS === 'ios' || Platform.OS === 'android';

function buildLeafletHtml(opts: {
  latitude: number;
  longitude: number;
  interactive: boolean;
  pinDraggable: boolean;
  editable: boolean;
}): string {
  const lat = Number(opts.latitude.toFixed(6));
  const lng = Number(opts.longitude.toFixed(6));
  const interactive = opts.interactive ? 'true' : 'false';
  const draggable = opts.pinDraggable ? 'true' : 'false';
  const editable = opts.editable ? 'true' : 'false';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #e8eef5; }
    .leaflet-control-attribution { font-size: 10px; }
    .resenha-pin-wrap {
      background: transparent !important;
      border: none !important;
      overflow: visible !important;
    }
    .resenha-pin {
      position: relative;
      width: 28px;
      height: 28px;
      background: #2F6BFF;
      border: 3px solid #ffffff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 10px rgba(18, 18, 24, 0.35);
    }
    .resenha-pin-dot {
      position: absolute;
      top: 7px;
      left: 7px;
      width: 8px;
      height: 8px;
      background: #ffffff;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var interactive = ${interactive};
      var draggable = ${draggable};
      var editable = ${editable};
      var map = L.map('map', {
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: false,
        attributionControl: true
      }).setView([${lat}, ${lng}], 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      var pin = L.divIcon({
        className: 'resenha-pin-wrap',
        html: '<div class="resenha-pin"><div class="resenha-pin-dot"></div></div>',
        iconSize: [32, 42],
        iconAnchor: [16, 38]
      });
      var marker = L.marker([${lat}, ${lng}], {
        icon: pin,
        draggable: draggable,
        autoPan: true
      }).addTo(map);

      function post(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }
      function sendMove(ll) {
        post({ type: 'move', latitude: ll.lat, longitude: ll.lng });
      }

      window.__resenhaSetView = function (lat, lng, animate) {
        var ll = L.latLng(lat, lng);
        marker.setLatLng(ll);
        map.setView(ll, Math.max(map.getZoom() || 15, 15), { animate: !!animate });
      };

      if (editable) {
        map.on('click', function (e) {
          marker.setLatLng(e.latlng);
          sendMove(e.latlng);
        });
      } else {
        map.on('click', function () { post({ type: 'press' }); });
        marker.on('click', function () { post({ type: 'press' }); });
      }
      marker.on('dragend', function () {
        sendMove(marker.getLatLng());
      });

      document.addEventListener('touchstart', function () { post({ type: 'touchstart' }); }, { passive: true });
      document.addEventListener('touchend', function () { post({ type: 'touchend' }); }, { passive: true });
      document.addEventListener('touchcancel', function () { post({ type: 'touchend' }); }, { passive: true });
    })();
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#E8EEF5',
  },
  map: {
    flex: 1,
    backgroundColor: '#E8EEF5',
  },
});
