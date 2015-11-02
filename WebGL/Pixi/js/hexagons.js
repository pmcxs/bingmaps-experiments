(function(exports) {

    /**
     * Library to define regular Hexagons.
     *
     *       ***************
     *      *|-------------|*
     *     *       (c)       *
     *    *                   *
     *   *----------|          ***************
     *    *   (a)             *               *
     *     *                 *                 *
     *      *       |-----------------|         *
     *       ***************    (b)              *
     *                      *                   *
     *                       *                 *
     *                        *               *
     *                         ***************
     *
     *
     *  (a) - diameter * 0.5
     *  (b) - narrowWidth
     *  (c) - edgeSize. All the edges have the same length (regular hexagon).
     *
     * Based on:
     * (1) http://www.gamedev.net/page/resources/_/technical/game-programming/coordinates-in-hexagon-based-tile-maps-r1800
     * (2) http://www-cs-students.stanford.edu/~amitp/game-programming/grids/
     * @param edgeSize
     */
    exports.HexDefinition = function(edgeSize) {

        this.h = Math.sin(30.0 * Math.PI / 180) * edgeSize;
        this.r = Math.cos(30.0 * Math.PI / 180) * edgeSize;
        this.b = edgeSize + 2.0 * this.h;
        this.a = 2.0 * this.r;

        this.edgeSize = edgeSize;
        this.narrowWidth = this.edgeSize + this.h;
        this.diameter = this.b;
        this.height = this.a;

        /**
         * Returns the center XY coordinates of the specified hexagon
         * @param u
         * @param v
         * @returns {{x: number, y: number}}
         */
        this.getCenterPointXY = function(u, v) {

            var x = this.narrowWidth * u;
            var y = this.height * (u * 0.5 + v);

            return { x: x, y: y };
        };

        /**
         * Returns the UV hexagon coordinate that contains the specified point
         * @param x
         * @param y
         * @returns {{u: number, v: number}}
         */
        this.getReferencePointUV = function(x, y) {

            var u = Math.round(x / this.narrowWidth);
            var v = Math.round(y / this.height - u * 0.5);

            if(this.isInsideHexagon(x,y, u,v)) {
                return { u:u, v: v };
            }
            else {

                //check surrounding hexagons

                var neighbours = [
                    { u: u, v: v-1},
                    { u: u, v: v+1},
                    { u: u-1, v: v},
                    { u: u+1, v: v},
                    { u: u-1, v: v+1},
                    { u: u+1, v: v-1}
                ];

                for(var i=0; i<neighbours.length; i++) {
                    if(this.isInsideHexagon(x,y,neighbours[i].u, neighbours[i].v)) {
                        return neighbours[i];
                    }
                }

            }

        };

        /**
         *
         * @param u
         * @param v
         * @param radius
         */
        this.getNearestHexagons = function (u, v, radius) {

            if(radius == undefined) radius = 1;

            var maxSteps = radius;

            var movementData = {};

            var endHexagons = [ { u: u, v: v, steps: 0} ];

            var i = 0;

            while(i < endHexagons.length) {

                var u = endHexagons[i].u;
                var v = endHexagons[i].v;
                var steps = endHexagons[i].steps + 1;
                i++;

                if(steps > maxSteps) {
                    break;
                }

                //check surrounding points
                var neighbours = [
                    { u: u, v: v - 1, steps: steps },
                    { u: u + 1, v: v - 1, steps: steps },
                    { u: u + 1, v: v, steps: steps },
                    { u: u, v: v + 1, steps: steps },
                    { u: u - 1, v: v + 1, steps: steps },
                    { u: u - 1, v: v, steps: steps }];


                for(var j=0; j < neighbours.length; j++) {

                    var neighbour = neighbours[j];

                    var existing = undefined;

                    for(var k=0; k < endHexagons.length; k++) {
                        var target = endHexagons[k];
                        if(target.u == neighbour.u && target.v == neighbour.v) {
                            existing = target;
                        }
                    }

                    if(existing == undefined) {

                        endHexagons.push( { u: neighbour.u, v: neighbour.v , steps: steps});
                    }

                }

            }

            return endHexagons;
        };

        this.getHexagonsInsideBoundingBox = function(minX,minY,maxX,maxY) {

            var topLeftUV = this.getReferencePointUV(minX, minY);

            var bottomLeftUV = this.getReferencePointUV(minX, maxY);

            var rowsEven = bottomLeftUV.v - topLeftUV.v + 1;

            var topLeftUVCenter = this.getCenterPointXY(topLeftUV.u, topLeftUV.v);
            var minX2 = topLeftUVCenter.x + this.narrowWidth;
            var topLeftUV2 = this.getReferencePointUV(minX2, minY);
            var bottomLeftUV2 = this.getReferencePointUV(minX2, maxY);
            var rowsOdd = bottomLeftUV2.v - topLeftUV2.v + 1;


            var bottomRightUV = this.getReferencePointUV(maxX, maxY);

            var columns = bottomRightUV.u - topLeftUV.u + 1;

            //console.log("even: " + rowsEven + "   odd: " + rowsOdd + "   columns: " + columns);

            var hexagons = [];

            for (var i = 0; i < columns; i++) {

                var rows = (i%2) == 0 ? rowsEven : rowsOdd;

                for (var j = 0 ; j < rows ; j++) {

                    var offset = topLeftUV.v == topLeftUV2.v ? Math.floor(i/2) :  Math.ceil(i/2);

                    var u = topLeftUV.u + i;
                    var v = topLeftUV.v + j - offset;
                    hexagons.push({u: u, v:v});
                }
            }

            return hexagons;

        };


        /**
         * Returns the various points of a specific hexagon.
         * @param u
         * @param v
         * @returns Array with all the hexagon points, sorted in clock-wise order starting in the left-most point.
         */
        this.getPointsOfHexagon = function(u, v) {

            var center = this.getCenterPointXY(u, v);

            return [
                { x: (center.x - this.diameter / 2.0), y: center.y },
                { x: (center.x - this.edgeSize / 2.0), y: (center.y - this.height / 2.0) },
                { x: (center.x + this.edgeSize / 2.0), y: (center.y - this.height / 2.0) },
                { x: (center.x + this.diameter / 2.0), y: center.y },
                { x: (center.x + this.edgeSize / 2.0), y: (center.y + this.height / 2.0) },
                { x: (center.x - this.edgeSize / 2.0), y: (center.y + this.height / 2.0) },
                { x: (center.x - this.diameter / 2.0), y: center.y }
            ];

        };

        /**
         * Determines if a certain point is inside the specified hexagon
         * @param x
         * @param y
         * @param u
         * @param v
         * @returns boolean if inside hexagon, false otherwise
         */
        this.isInsideHexagon = function(x, y, u, v) {

            var center = this.getCenterPointXY(u, v);

            var d = this.diameter;
            var dx = Math.abs(x - center.x)/d;
            var dy = Math.abs(y - center.y)/d;
            var a = 0.25 * Math.sqrt(3.0);
            return (dy <= a) && (a*dx + 0.25*dy <= 0.5*a);
        };


        /**
         * Calculates the hexagonal distance between two hexagons, not taking into account any restrictions
         * @param u1
         * @param v1
         * @param u2
         * @param v2
         */
        this.getDistanceBetweenHexagons = function(u1,v1, u2, v2) {

            du = u2 - u1;
            dv = v2 - v1;

            if( du * dv > 0) {
                return Math.abs(du + dv);
            }
            else {
                return Math.max(Math.abs(du), Math.abs(dv));
            }
        };


        /**
         * Creates an hexagon
         * @param u
         * @param v
         * @returns {{u: *, v: *, points: Array}}
         */
        this.createHexagon = function(u,v) {

            return {
                u: u,
                v: v,
                center: this.getCenterPointXY(u, v),
                points: this.getPointsOfHexagon(u,v)
            };

        };

    };

})(typeof exports === 'undefined' ? this['hexagons']={}: exports);





