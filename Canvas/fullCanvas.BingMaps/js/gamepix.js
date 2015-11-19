function pixelMapEngine(options) {

    /**
     * Settings that can be overriden when initializing the map engine
     */
    var defaults = {
        /**
         * Gamepix API base url
         */
        api: "http://gamepix-devel-cs.cloudapp.net/v1",

        /**
         * Mapping API Key
         */
        mapkey: "DEFINE_MAP_KEY_HERE",

        /**
         * Determines if a Grid should be displayed or not
         */
        drawGrid: true,

        /**
         * Determines if a countries layer is drawn or not
         */
        countriesLayer: true,

        /**
         * Opacity of the countries layer. 0 totally transparent, 1 totally opaque
         */
        countriesLayerOpacity: 0.3,

        /**
         * Determines the zoom level until the countries layer is displayed.
         * By default is 7, so the layer will be visible from levels 0 to 7.
         */
        countriesLayerMaxZoomLevel: 7,

        /**
         * Determines if the pixel that is being hovered is painted during the cursor movement
         */
        drawHoveredPixel: true,

        /**
         * The hovered pixel will be represented from this zoom level until max zoom.
         */
        drawHoveredPixelZoomLevel: 11,

        /**
         * Zoom level from which click events are triggered
         */
        clickZoomLevel: 11,

        /**
         * Zoom Level on which a screen pixel maps exactly to one Gamepix pixel
         */
        pixelZoomLevel: 7,

        /**
         * Zoom level when the pixels start be drawn
         */
        pixelsMinZoomLevel: 8,

        /**
         * Number of tiles that are used to create a virtual buffer when loading requests.
         * If zero, the number of loaded points corresponds exactly to the extents of the visible tiles on the map.
         */
        tilesDataBuffer: 1,

        /**
         * Determines if an OpenStreetMap (OSM) Layer should be displayed
         */
        useOsm: false,

        /**
         * Display a base map from the mapping API provider
         */
        useBaseMap: true,

        /**
         * Log messages to the debug console
         */
        log: true,

        /**
         * Callback that is called when a pixel is clicked uppon
         * @param occupied
         * @param location
         */
        clickHandler: function(occupied, location) {
            console.log("Clicked pixel: " + location.locCenter.latitude + "," + location.locCenter.longitude + ")");
        },


        /**
         * Executed after new data has been loaded. Useful to change/update the loaded data.
         * For instance to denormalize the loaded pixels.
         * @param data
         */
        loadDataCallback: function(data) {
            console.log("Loaded pixels: " + data.length);

        }
    };

    var config = _.extend(defaults, options);

    var tileLayer;
    var utfGrid;
    var countries;
    var currentData = [];

    var selection;

    var currentBounds;

    var MM = Microsoft.Maps;
    var map = new MM.Map(document.getElementById("mapDiv"), {
        center: new MM.Location(38.8, -8.916),
        inertiaIntensity: 0.5,
        zoom: 9,
        mapTypeId: config.useBaseMap ? Microsoft.Maps.MapTypeId.auto :Microsoft.Maps.MapTypeId.mercator,
        backgroundColor: MM.Color.fromHex('C2E0FA'),
        credentials: config.mapkey});

    registerBingMapsModules();

    _refreshView();

    if(config.useOsm) {
        loadBaseMap();
    }

    MM.Events.addHandler(map, 'mousemove', drawHoveredPixel);

    MM.Events.addHandler(map, 'click', conquerPixel);

    MM.loadModule("CanvasTileLayerModule", {
        callback: canvasTileLayerModuleLoaded
    });

    function loadBaseMap() {

        var tileSource = new MM.TileSource({ uriConstructor:  function (tile) {

            var x = tile.x;
            var z = tile.levelOfDetail;
            var y = tile.y;

            return "http://otile4.mqcdn.com/tiles/1.0.0/osm/" + z + "/" + x + "/" + y + ".png";
        }});

        var tileLayer = new MM.TileLayer({ mercator: tileSource});
        map.entities.push(tileLayer);

    }

    function canvasTileLayerModuleLoaded() {

        tileLayer = new CanvasTileLayer(map,
            {
                debugMode: false,
                cacheTiles: true,
                drawTile: function (context, tile) {
                    paintTile(context, tile);
                }
            });

        $.ajax({
            url: config.api + "/countries"

        }).done(function (data) {

                countries = {};
                for (var i = 0; i < data.length; i++) {

                    var countryColor = { r: data[i].red, g: data[i].green, b: data[i].blue };
                    countries[data[i].name] = countryColor;
                }

                MM.loadModule("UtfGridModule", {
                    callback: function () {

                        utfGrid = new UtfGrid(map, 'Data/Countriesjsonp/{z}/{x}/{y}.grid.json', {
                            maxZoomLevel: 7,
                            jsonp:true,

                            mouseoverCallback: function (result) {

                                if(result != undefined) {
                                    console.log("current country: " + result.NAME);
                                }

                            },

                            tileLoadedCallback: function (tile) {
                                if (tileLayer != undefined) {
                                    tileLayer.clearTile(tile.levelOfDetail, tile.x, tile.y);
                                    tileLayer.refresh();
                                }
                            }
                        });

                        map.entities.push(utfGrid);

                    }});
            });


        MM.Events.addThrottledHandler(map, 'viewchangeend', function () {
            _refreshView();

        }, 250);
    }

    /*
     * Register the used Bing Maps modules (without loading them)
     */
    function registerBingMapsModules() {
        MM.registerModule("CanvasTileLayerModule", "js/CanvasTileLayerModule.js");
        MM.registerModule("UtfGridModule", "js/UtfGridModule.js");
    }

    function _refreshView() {

        if (map.getZoom() < config.pixelZoomLevel) {
            return;
        }

        if(currentBounds == undefined) {
            currentBounds = getDataBounds(config.tilesDataBuffer);
            loadData(currentBounds.north, currentBounds.south, currentBounds.east, currentBounds.west);
        }
        else {

            var viewportBox = getDataBounds(0);

            if(viewportBox.north < currentBounds.north &&
                viewportBox.south > currentBounds.south &&
                viewportBox.west > currentBounds.west &&
                viewportBox.east < currentBounds.east) {

                if(config.log) {
                    console.log("No need to load data. Still inside bounds");
                }
            }
            else {
                currentBounds = getDataBounds(config.tilesDataBuffer);
                loadData(currentBounds.north, currentBounds.south, currentBounds.east, currentBounds.west);
            }
        }

    }


    /*
     *  Iterates the current data and returns the tiles that contain pixels from that dataset
     */
    function getTilesWithData(zoom, currentData) {

        var tilesWithData = [];

        var zoomFactor = Math.pow(2, zoom - config.pixelZoomLevel);

        for (var i = 0; i < currentData.length; i++) {

            var pixelXY =  currentData[i].point;

            var tileX = Math.floor(pixelXY.x * zoomFactor / 256);
            var tileY = Math.floor(pixelXY.y * zoomFactor / 256);

            var tile = {z: zoom, x: tileX, y: tileY};

            tilesWithData.pushIfNotExist(tile, function (e) {
                return e.z === tile.z && e.x === tile.x && e.y === tile.y;
            });
        }

        return tilesWithData;
    }


    /*
     * Returns the bounds for loading data
     */
    function getDataBounds(tileBuffer) {

        var bounds = map.getBounds();

        var zoom = map.getZoom();

        var north = bounds.getNorth();
        var south = bounds.getSouth();
        var east = bounds.getEast();
        var west = bounds.getWest();

        var pixelXYTopLeft = LatLongToPixelXY(north, west, zoom);
        var pixelXYBottomRight = LatLongToPixelXY(south, east, zoom);

        var tileXTopLeft = Math.floor(pixelXYTopLeft.x / 256) - tileBuffer;
        var tileYTopLeft = Math.floor(pixelXYTopLeft.y / 256) - tileBuffer;

        var tileXBottomRight =  Math.floor(pixelXYBottomRight.x / 256) + 1 + tileBuffer;
        var tileYBottomRight =  Math.floor(pixelXYBottomRight.y / 256) + 1 + tileBuffer;

        pixelXYTopLeft.x = tileXTopLeft * 256;
        pixelXYTopLeft.y = tileYTopLeft * 256;

        pixelXYBottomRight.x =  tileXBottomRight * 256;
        pixelXYBottomRight.y =  tileYBottomRight * 256;

        var latLongTopLeft = PixelXYToLatLong(pixelXYTopLeft.x, pixelXYTopLeft.y, zoom);
        var latLongBottomRight = PixelXYToLatLong(pixelXYBottomRight.x, pixelXYBottomRight.y, zoom);

        return {
            north: latLongTopLeft.latitude,
            west: latLongTopLeft.longitude,
            south: latLongBottomRight.latitude,
            east: latLongBottomRight.longitude
        };
    }

    /*
     * Fetches pixel information from a certain bounding box and forces the tile layers to refresh
     */
    function loadData(north, south, east, west) {

        if(config.log) {
            console.log("Loading data. North: " + north + ", South: " + south + ", East: " + east + ", West: " + west);
        }

        var url = config.api + "/pixels?nwLat=" + north + "&nwLng=" + west + "&seLat=" + south + "&seLng=" + east;

        $.ajax({
            url: url
        }).done(function (data) {

                var points = _.map(data, function(coordinate) {
                    return {
                        coordinate: coordinate,
                        point: LatLongToPixelXYWithoutRounding(coordinate.lat, coordinate.lng, config.pixelZoomLevel),
                        pixel: LatLongToPixelXY(coordinate.lat, coordinate.lng, config.pixelZoomLevel)
                    };

                });

                currentData = points;

                config.loadDataCallback(currentData);

                _drawPoints();


        });
    }


    function _drawPoints() {


        if (tileLayer != undefined) {

            var tiles = getTilesWithData(map.getZoom(), currentData);
            for (var i = 0; i < tiles.length; i++) {
                tileLayer.clearTile(tiles[i].z, tiles[i].x, tiles[i].y);
            }
            tileLayer.refresh();
        }
    }



    function drawGrid(contextGrid, z) {

        var steps = Math.pow(2, 15 - z);

        var stepSize = 256.0 / steps;

        if (z >= 9) {

            if (z == 9) {
                contextGrid.strokeStyle = "rgba(100, 100, 250, 0.2)";
            }
            else if (z == 10) {
                contextGrid.strokeStyle = "rgba(100, 100, 250, 0.4)";
            }
            else {
                contextGrid.strokeStyle = "rgba(100, 100, 250, 0.4)";
            }
            contextGrid.beginPath();

            for (var i = 0; i <= steps; i++) {

                contextGrid.moveTo(stepSize * i + 1, 0);
                contextGrid.lineTo(stepSize * i + 1, 256);

                if (i == steps) break;

                contextGrid.moveTo(0, stepSize * i + 1);
                contextGrid.lineTo(256, stepSize * i + 1);
            }
            contextGrid.closePath();
            contextGrid.stroke();
        }

    }

    function conquerPixel(e) {

        if(map.getZoom() < config.clickZoomLevel) return;

        var location = getPixelFromEvent(e);

        if(location == undefined) {
            return;
        }

        var pixelOccupied = false;

        //check if this pixel is already conquered
        for (var i = 0; i < currentData.length; i++) {

            if(currentData[i].coordinate.lat < location.locNW.latitude &&
               currentData[i].coordinate.lat > location.locSE.latitude &&
               currentData[i].coordinate.lng > location.locNW.longitude &&
               currentData[i].coordinate.lng < location.locSE.longitude) {

                pixelOccupied = true;
                break;
            }
        }

        if(config.clickHandler != undefined) {
            config.clickHandler(pixelOccupied, location);
        }

    }

    /*
     * Draw the currently hovered game pixel
     * Note: Just operates above a certain zoom level, ignoring transitions.
     */
    function drawHoveredPixel(e) {


        if(map.getZoom() < config.drawHoveredPixelZoomLevel || config.drawHoveredPixel ==false) {
            return;
        }

        var location = getPixelFromEvent(e);

        if(location == undefined) {
            return;
        }

        if (selection != undefined) {
            map.entities.remove(selection);
        }


        var polygoncolor = new MM.Color(100, 100, 0, 100);
        selection = new MM.Polygon([location.locNW, location.locNE, location.locSE, location.locSW], {fillColor: polygoncolor, strokeColor: polygoncolor});

        // Add the shape to the map
        map.entities.push(selection);

    }


    function getPixelFromEvent(e) {

        var zoom = map.getZoom();

        if (zoom % 1 != 0) return;

        var mouseX = e.getX();
        var mouseY = e.getY();
        var point = new MM.Point(mouseX, mouseY);
        var loc = map.tryPixelToLocation(point);

        var worldpixel = LatLongToPixelXY(loc.latitude, loc.longitude, zoom);

        var tileX = worldpixel.x / 256.0;
        var tileY = worldpixel.y / 256.0;

        var x = (tileX - Math.floor(tileX)) * 256;
        var y = (tileY - Math.floor(tileY)) * 256;

        var steps = Math.pow(2, 15 - zoom);
        var stepSize = 256.0 / steps;


        var pixelIndexX = (x / stepSize) | 0;
        var pixelIndexY = (y / stepSize) | 0;

        var xOffset = x - stepSize * pixelIndexX;
        var yOffset = y - stepSize * pixelIndexY;


        var pixelNW = new MM.Point(mouseX - xOffset, mouseY - yOffset);
        var pixelNE = new MM.Point(mouseX - xOffset + stepSize, mouseY - yOffset);
        var pixelSE = new MM.Point(mouseX - xOffset + stepSize, mouseY - yOffset + stepSize);
        var pixelSW = new MM.Point(mouseX - xOffset, mouseY - yOffset + stepSize);
        var pixelCenter = new MM.Point(mouseX - xOffset + stepSize / 2, mouseY - yOffset + stepSize /2);

        return {
            pixel: LatLongToPixelXY(loc.latitude, loc.longitude, config.pixelZoomLevel),
            locNW: map.tryPixelToLocation(pixelNW),
            locNE: map.tryPixelToLocation(pixelNE),
            locSE: map.tryPixelToLocation(pixelSE),
            locSW: map.tryPixelToLocation(pixelSW),
            locCenter: map.tryPixelToLocation(pixelCenter)
        };

    }


    /*
     * Given a certain country name return its country data.
     * Note: For some countries an hardcoded mapping has to be done as there's no match
     * between the UTFGrid data and the country data obtained from the API
     */
    function getCountryData(countryName) {

        var mappings = {
            "Czech Rep.": "Czech Republic",
            "N. Cyprus": "Cyprus",
            "Bosnia and Herz.": "Bosnia and Herzegovina"
        };

        if (mappings[countryName] != undefined) {
            countryName = mappings[countryName];
        }


        return countries[countryName];
    }

    function paintCountries(polygons, zoomLevel, context) {

        for (var key in polygons) {

            for (var i = 0; i < key.length; i++) {

                var polygonsForKey = polygons[key[i]].geometries;

                var data = polygons[key[i]].data;

                if (polygonsForKey == undefined) continue;

                for (var j = 0; j < polygonsForKey.length; j++) {

                    var polygon = polygonsForKey[j];

                    var countryData = getCountryData(data.NAME);

                    if (countryData == undefined) continue;

                    var color = "rgba(" + countryData.r + "," + countryData.g + "," + countryData.b + "," + config.countriesLayerOpacity + ")";
                    context.fillStyle = color;

                    var resolution = utfGrid.getTileSize();

                    /**** fill polygon ****/

                    context.beginPath();
                    context.moveTo(polygon.points[0].x * resolution, polygon.points[0].y * resolution);

                    for (var k = 1; k < polygon.points.length; k++) {
                        var point = polygon.points[k];
                        context.lineTo(point.x * resolution, point.y * resolution);
                    }

                    context.closePath();
                    context.fill();

                    // border

                    context.beginPath();
                    context.moveTo(polygon.points[0].x * resolution, polygon.points[0].y * resolution);

                    for (var k = 1; k < polygon.points.length; k++) {

                        var previousPoint = polygon.points[k - 1];
                        var point = polygon.points[k];

                        if ((previousPoint.y == 0 && point.y == 0) ||
                            (previousPoint.x == 0 && point.x == 0) ||
                            (previousPoint.x * resolution == 256 && point.x * resolution == 256) ||
                            (previousPoint.y * resolution == 256 && point.y * resolution == 256)) {

                            context.moveTo(point.x * resolution, point.y * resolution);
                        }
                        else {
                            context.lineTo(point.x * resolution, point.y * resolution);
                        }
                    }

                    if (zoomLevel > 2) {
                        context.lineWidth = 4;
                        context.strokeStyle = "rgba(200,200,200,0.4)";
                        context.stroke();
                    }

                    if (zoomLevel > 4) {
                        context.lineWidth = 2;
                        context.strokeStyle = "rgba(100,100,100,0.2)";
                        context.stroke();
                    }
                }
            }
        }
    }

    function paintTile(context, tile) {

        if (tile.z <= config.countriesLayerMaxZoomLevel) {

            if(config.countriesLayer) {

                if (utfGrid != undefined && utfGrid.getTileData(tile) != undefined) {

                    var polygons = parseUtfGrid(utfGrid.getTileData(tile));
                    optimizePolygons(polygons, 256.0 / utfGrid.getTileSize());
                    paintCountries(polygons, tile.z, context);
                }
            }
        }


        if (tile.z >= config.pixelsMinZoomLevel) {

            drawGrid(context, tile.z);

            var steps = Math.pow(2, 15 - tile.z);
            var stepSize = 256.0 / steps;

            var items = new Array(steps);
            for (var i = 0; i < items.length; i++) {
                items[i] = new Array(steps);
                for (var j = 0; j < items[i].length; j++) {
                    items[i][j] = 0;
                }
            }

            var zoomFactor = Math.pow(2, tile.z - config.pixelZoomLevel);

            for (var i = 0; i < currentData.length; i++) {

                var canvasPixel = tile.getPixelOffset({x: currentData[i].point.x * zoomFactor, y: currentData[i].point.y * zoomFactor});

                var x = canvasPixel.x;
                var y = canvasPixel.y;

                if (canvasPixel.x < 0 || canvasPixel.x > 256 || canvasPixel.y < 0 || canvasPixel.y > 256) {
                    continue;
                }

                var indexX = Math.floor(x / stepSize);
                var indexY = Math.floor(y / stepSize);

                if (indexX >= 0 && indexX < steps && indexY >= 0 && indexY < steps) {
                    items[indexX][indexY]++;
                }
            }


            context.fillStyle = "rgba(100, 100, 200, 0.6)";

            if (tile.z < 9) {
                context.strokeStyle = "rgba(150, 150, 150, 0.2)";

            }
            else {
                context.strokeStyle = "rgba(50, 50, 50, 0.8)";
            }


            for (var i = 0; i < items.length; i++) {

                for (var j = 0; j < items[i].length; j++) {

                    if (items[i][j] > 0) {

                        context.fillRect(i * stepSize, j * stepSize, stepSize, stepSize);

                        context.strokeRect(i * stepSize, j * stepSize, stepSize, stepSize);

                    }

                }
            }

        }

    }


    this.refreshView = function() {

        config.loadDataCallback(currentData);

        _drawPoints();

    }






}
