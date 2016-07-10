leaflet-linkedtag
===========================

Create a draggable Tag line to it's owner Marker.

Check out the [demo](https://cloudybay.github.io/leaflet-linkedtag/example/).

### Usage example

```javascript
L.marker([25.0, 121.5]).bindTag(
    '雲灣資訊', {
        lineOptions: {
            color: '#f00',
        },
        offset: [80, -80]
    }).showTag().addTo(map);

```

