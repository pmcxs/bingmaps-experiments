


    var EarthRadius = 6378137;
    var MinLatitude = -85.05112878;
    var MaxLatitude = 85.05112878;
    var MinLongitude = -180;
    var MaxLongitude = 180;

    function MapSize(levelOfDetail) {
        return 256 << levelOfDetail;
    }



    function LatLongToPixelXY(latitude, longitude, levelOfDetail) {

        var sinLatitude = Math.sin(latitude * Math.PI / 180);
        var pixelX = ((longitude + 180) / 360) * 256 * (2 << (levelOfDetail - 1));
        var pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * 256 * (2 << (levelOfDetail - 1));

        return {
            x: (0.5 + pixelX) | 0,
            y: (0.5 + pixelY) | 0};
    }

    function LatLongToPixelXYWithoutRounding(latitude, longitude, levelOfDetail) {

        var sinLatitude = Math.sin(latitude * Math.PI / 180);
        var pixelX = ((longitude + 180) / 360) * 256 * (2 << (levelOfDetail - 1));
        var pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * 256 * (2 << (levelOfDetail - 1));

        return {
            x: pixelX,
            y: pixelY};

    }



    function GetTileForLocation(latitude, longitude, zoom) {

        var pixelXY = LatLongToPixelXY(latitude, longitude, zoom);

        var tileX = Math.floor(pixelXY.x / 256.0);
        var tileY = Math.floor(pixelXY.y / 256.0);
        var tileZ = Math.floor(zoom);

        return { z: tileZ, x: tileX, y: tileY };

    }

    function PixelXYToLatLong(pixelX, pixelY, levelOfDetail) {
        var mapSize = MapSize(levelOfDetail);
        var x = (Clip(pixelX, 0, mapSize - 1) / mapSize) - 0.5;
        var y = 0.5 - (Clip(pixelY, 0, mapSize - 1) / mapSize);

        return {
            latitude: 90 - 360 * Math.atan(Math.exp(-y * 2 * Math.PI)) / Math.PI,
            longitude: 360 * x
        }

    }

    function Clip(n, minValue, maxValue) {
        return Math.min(Math.max(n, minValue), maxValue);
    }

    function GroundResolution(latitude, levelOfDetail) {
        var latitude = Clip(latitude, MinLatitude, MaxLatitude);
        return Math.cos(latitude * Math.PI / 180) * 2 * Math.PI * EarthRadius / MapSize(levelOfDetail);
    }

