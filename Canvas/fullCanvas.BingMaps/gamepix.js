function loadMap(config) {

    var baseUrl = config.api;

    var pointCanvas;

    var shiftMode = 1;

    var currentData = [];

    var selection;

    var currentBounds;

    var canvasImage;

    var currentOffset;

    var topLeftPixelXY;

    var MM = Microsoft.Maps;
    var map = new MM.Map(document.getElementById("mapDiv"), {
        center: new MM.Location(38.8, -8.916),
        inertiaIntensity: 0.5,
        zoom: 9,
        tileBuffer: 4,
        credentials: config.mapkey});

    loadPointCanvas(map);



    if(config.drawGrid) {
        generateGrid(map);
    }

    MM.Events.addHandler(map, 'mousemove', drawHoveredPixel);


    MM.Events.addHandler(map, 'viewchange', function (e) {

        if(e.linear) {
            shiftCanvas();
        }
        else {
            clearCanvas();
        }
    });


    MM.Events.addHandler(map, 'viewchangeend', function () {

        if (map.getZoom() < 8) {
            clearCanvas();
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

                drawPoints(map, pointCanvas, currentData);
            }
            else {
                currentBounds = getDataBounds(config.tilesDataBuffer);
                loadData(currentBounds.north, currentBounds.south, currentBounds.east, currentBounds.west);

            }
        }

    }, 0);

    function shiftCanvas() {

        if(canvasImage == undefined)  return;

        var bounds = map.getBounds();
        var currentTopLeftPixelXY = LatLongToPixelXY(bounds.getNorth(), bounds.getWest(), map.getZoom());
        if(topLeftPixelXY == undefined) topLeftPixelXY = currentTopLeftPixelXY;


        var offsetX = currentTopLeftPixelXY.x - topLeftPixelXY.x;
        var offsetY = currentTopLeftPixelXY.y - topLeftPixelXY.y;


        if(shiftMode == 0) {
            $(pointCanvas).css({marginLeft: '-=' + offsetX + 'px'});
            $(pointCanvas).css({marginTop: '-=' + offsetY + 'px'});

        }
        else {
            var context = pointCanvas.getContext("2d");

            context.clearRect(0, 0, canvasImage.width, canvasImage.height);

            currentOffset.x -= offsetX;
            currentOffset.y -= offsetY;

            context.putImageData(canvasImage, currentOffset.x, currentOffset.y);

        }
        topLeftPixelXY = currentTopLeftPixelXY;

    }

    function clearCanvas() {

        if(canvasImage == undefined)  return;

        pointCanvas.getContext("2d").clearRect(0, 0, canvasImage.width, canvasImage.height);

    }


    function loadPointCanvas(map) {
        pointCanvas = document.createElement('canvas');
        pointCanvas.id = 'pointscanvas';
        pointCanvas.style.position = 'relative';
        pointCanvas.height = map.getHeight();
        pointCanvas.width = map.getWidth();

        var mapDiv = map.getRootElement();
        mapDiv.parentNode.lastChild.appendChild(pointCanvas);
    }


    function drawPoints(map, pointCanvas, points) {

        if(shiftMode == 0) {
            $(pointCanvas).css({marginLeft: '0px'});
            $(pointCanvas).css({marginTop: '0px'});

            pointCanvas.height = map.getHeight();
            pointCanvas.width = map.getWidth();
        }
        else {
            currentOffset = { x:0, y:0};
        }

        var currentZoom = map.getZoom();

        var context = pointCanvas.getContext("2d");
        var bounds = map.getBounds();

        var maxLatitude = bounds.getNorth();
        var minLatitude = bounds.getSouth();
        var maxLongitude = bounds.getEast();
        var minLongitude = bounds.getWest();

        var topLeftCornerGrid = LatLongToPixelXYWithoutRounding(maxLatitude, minLongitude, 7);

        var imageData = context.createImageData(pointCanvas.width, pointCanvas.height);

        var steps = Math.pow(2, 15 - currentZoom);

        var gridFactor = Math.pow(2, currentZoom - config.gridLevel);


        var stepSize = 256.0 / steps;
        var radius = stepSize / 2;


        var pointsDrawn = 0;


        for (var i = 0; i < points.length; i++) {

           var loc = points[i];

           //discard coordinates outside the current map view
           if (loc.lat >= minLatitude && loc.lat <= maxLatitude &&
               loc.lng >= minLongitude && loc.lng <= maxLongitude) {

               pointsDrawn++;

               var pointGrid = LatLongToPixelXYWithoutRounding(loc.lat, loc.lng, config.gridLevel);

               var pointGridX = Math.floor(pointGrid.x);
               var pointGridY = Math.floor(pointGrid.y);

               var offsetGridX = pointGridX - topLeftCornerGrid.x;
               var offsetGridY = pointGridY - topLeftCornerGrid.y;

               var xGrid = Math.round(offsetGridX * gridFactor);
               var yGrid = Math.round(offsetGridY * gridFactor);


               radius = stepSize / 2;

               for(var u = -radius; u <= radius; u++) {
                   for(var v = -radius; v <= radius;  v++) {
                       setPixel(imageData, xGrid+u+radius,   yGrid+v+radius, points[i].color.r, points[i].color.g, points[i].color.b, 120);
                   }
               }

           }
        }

        canvasImage = imageData;

        context.putImageData(canvasImage, 0, 0);

    }

    function setPixel(imageData, x, y, r, g, b, a) {

        //find index based on the pixel coordinates
        var index = (x + y * imageData.width) * 4;

        //set pixel
        imageData.data[index + 0] = r;
        imageData.data[index + 1] = g;
        imageData.data[index + 2] = b;
        imageData.data[index + 3] = a;
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
            //console.log("Loading data. North: " + north + ", South: " + south + ", East: " + east + ", West: " + west);
        }

        var url = baseUrl + "/pixels?nwLat=" + north + "&nwLng=" + west + "&seLat=" + south + "&seLng=" + east;

        drawPoints(map, pointCanvas,{});


        $("#log").show();
        $("#log").html("Loading pixels");

        $.ajax({
            url: url
        }).done(function (data) {


                $("#log").hide();


                currentData = data;

                if (data.length === 1000) {
                    console.log("Results limited to 1000");
                }

                drawPoints(map, pointCanvas, data);

        });
    }

    /*
     * Generates a tile layer with a grid
     */
    function generateGrid(map) {

        var gridImages = {};

        var canvasGrid = document.createElement("canvas");
        canvasGrid.width = 256;
        canvasGrid.height = 256;
        canvasGrid.id = "grid";

        var contextGrid = canvasGrid.getContext("2d");

        for (var z = 9; z <= 14; z++) {

            contextGrid.clearRect(0, 0, canvasGrid.width, canvasGrid.height);

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

            gridImages[z] = canvasGrid.toDataURL();

        }

        var tileSourceGrid = new MM.TileSource({uriConstructor: function (tileInfo) {
            return gridImages[tileInfo.levelOfDetail];
        }});
        var tilelayerGrid = new MM.TileLayer({ mercator: tileSourceGrid});
        map.entities.push(tilelayerGrid);
    }



    function conquerPixel(e) {

        var location = getPixelFromEvent(e);

        if(location == undefined) {
            return;
        }

        alert("Conquered pixel: " + location.locCenter.latitude + "," + location.locCenter.longitude + ")");
        //TODO: SUBMIT TO SERVER - PENDING
    }

    /*
     * Draw the currently hovered game pixel
     * Note: Just operates above a certain zoom level, ignoring transitions.
     */
    function drawHoveredPixel(e) {

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

        if (zoom < 9) return;

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


        var pointNW = new MM.Point(mouseX - xOffset, mouseY - yOffset);
        var pointNE = new MM.Point(mouseX - xOffset + stepSize, mouseY - yOffset);
        var pointSE = new MM.Point(mouseX - xOffset + stepSize, mouseY - yOffset + stepSize);
        var pointSW = new MM.Point(mouseX - xOffset, mouseY - yOffset + stepSize);
        var pointCenter = new MM.Point(mouseX - xOffset + stepSize / 2, mouseY - yOffset + stepSize /2);

        return {
            locNW: map.tryPixelToLocation(pointNW),
            locNE: map.tryPixelToLocation(pointNE),
            locSE: map.tryPixelToLocation(pointSE),
            locSW: map.tryPixelToLocation(pointSW),
            locCenter: map.tryPixelToLocation(pointCenter)
        };

    }
}