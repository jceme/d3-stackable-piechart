(function () {

    var jsonFileSource = "flare.json";
    // var jsonFileSource = "mydata.json";

    var width = 960,
        height = 450,
        radius = Math.min(width, height) / 2,
        innerRadius = radius * 0.4,
        transitionDuration = 1000;


    var svg = d3.select("svg#categories")
        .attr("viewBox", "0 0 " + width + " " + height)
        .append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    svg.append("g")
        .attr("class", "circles");
    svg.append("g")
        .attr("class", "slices");
    svg.append("g")
        .attr("class", "labelName");
    svg.append("g")
        .attr("class", "labelValue");
    svg.append("g")
        .attr("class", "lines");

    var pie = d3.layout.pie()
        .sort(null)
        .value(function(d) {
            return d.size;
        });

    var arc = d3.svg.arc()
        .outerRadius(radius * 0.8)
        .innerRadius(innerRadius);

    var circleArc = d3.svg.arc()
        .startAngle(0)
        .endAngle(2 * Math.PI);

    var circleLayout = function (data) {
        var cnt = data.length;
        if (!cnt) {
            throw new Error("No data provided");
        }
        var arcRadius = innerRadius / cnt;

        var result = data.reverse().map(function (d, i) {
            return {
                data: d,
                innerRadius: i * arcRadius,
                outerRadius: (i + 1) * arcRadius
            };
        });
        return result;
    };

    var outerArc = d3.svg.arc()
        .innerRadius(radius * 0.9)
        .outerRadius(radius * 0.9);

    var tooltip = d3.select(document.body)
        .append("div")
        .attr("class", "toolTip");

    var colorRange = d3.scale.category20c();
    var color = d3.scale.ordinal()
        .range(colorRange.range());

    var categories = null,
        currentData = null;


    d3.json(jsonFileSource, function (error, root) {
        if (error) {
            alert("Cannot retrieve JSON data: " + error);
            return;
        }

        amendParents(root);
        accumulateLeafData(root);

        categories = root;
        currentData = root;
        change();
    });


    function amendParents(obj, parent) {
        obj.parent = parent;

        if (obj.children) {
            obj.children.forEach(function(child) {
                amendParents(child, obj);
            });
        }
    }

    function accumulateLeafData(obj) {
        if (obj.children) {
            var childrenSize = obj.children.reduce(function(sum, child) {
                return sum + accumulateLeafData(child);
            }, 0);
            obj.size = childrenSize;
            return childrenSize;
        } else {
            return obj.size;
        }
    }


    function change() {

        var pieData = currentData.children || [];

        var parentData = [];
        iterateParents(function (parent) {
            parentData.push(parent);
        });
        var parentCount = parentData.length - 1;

        /* ------- INNER CIRCLES -------*/
        var circles = svg.select(".circles").selectAll("path.circle")
            .data(circleLayout(parentData));

        circles.enter()
            .insert("path")
            .style("fill", function (d) {
                return color(d.data.name);
            })
            .attr("class", "circle");

        circles
            .classed("clickable", function (_, i) {
                return i < parentCount;
            })
            .transition().duration(transitionDuration)
            .style("fill", function (d) {
                return color(d.data.name);
            })
            .attrTween("d", function(d) {
                var isNew = !this._current;
                if (isNew) {
                    var cur = shallowCopy(d);
                    cur.innerRadius = innerRadius;
                    cur.outerRadius = innerRadius;
                    this._current = cur;
                }
                var interpolate = d3.interpolate(this._current, shallowCopy(d));
                this._current = interpolate(0);
                return function(t) {
                    return circleArc(interpolate(t));
                };
            });
        circles
            .on("mousemove", showTooltip);
        circles
            .on("mouseout", hideTooltip);
        circles
            .on("click", function(d, i) {
                if (i < parentCount) {
                    currentData = d.data;
                    change();
                }
            });

        circles.exit()
            .transition().duration(transitionDuration)
            .attrTween("d", function() {
                var d = shallowCopy(this._current);
                d.innerRadius = innerRadius;
                d.outerRadius = innerRadius;
                var interpolate = d3.interpolate(this._current, d);
                return function(t) {
                    return circleArc(interpolate(t));
                };
            })
            .remove();

        /* ------- PIE SLICES -------*/
        var slice = svg.select(".slices").selectAll("path.slice")
            .data(pie(pieData));

        slice.enter()
            .insert("path")
            .style("fill", function (d) {
                return color(d.data.name);
            })
            .attr("class", "slice");

        slice
            .classed("clickable", function (d) {
                return !!d.data.children;
            })
            .transition().duration(transitionDuration)
            .style("fill", function (d) {
                return color(d.data.name);
            })
            .attrTween("d", function(d) {
                var isNew = !this._current;
                if (isNew) {
                    var cur = shallowCopy(d);
                    cur.startAngle = 2 * Math.PI;
                    cur.endAngle = 2 * Math.PI;
                    this._current = cur;
                }
                var interpolate = d3.interpolate(this._current, shallowCopy(d));
                this._current = interpolate(0);
                return function(t) {
                    return arc(interpolate(t));
                };
            });
        slice
            .on("mousemove", showTooltip);
        slice
            .on("mouseout", hideTooltip);
        slice
            .on("click", function(d) {
                if (d.data.children) {
                    currentData = d.data;
                    change();
                }
            });

        slice.exit()
            .transition().duration(transitionDuration)
            .attrTween("d", function() {
                var d = shallowCopy(this._current);
                d.startAngle = 2 * Math.PI;
                d.endAngle = 2 * Math.PI;
                var interpolate = d3.interpolate(this._current, d);
                return function(t) {
                    return arc(interpolate(t));
                };
            })
            .remove();

        /* ------- TEXT LABELS -------*/

        var text = svg.select(".labelName").selectAll("text")
            .data(pie(pieData));

        text.enter()
            .append("text")
            .attr("dy", ".35em")
            .text(function(d) {
                return (d.data.name);
            });

        text
            .classed("clickable", function (d) {
                return !!d.data.children;
            })
            .transition().duration(transitionDuration)
            .attrTween("transform", function(d) {
                var isNew = !this._current;
                if (isNew) {
                    var cur = shallowCopy(d);
                    cur.startAngle = 2 * Math.PI;
                    cur.endAngle = 2 * Math.PI;
                    this._current = cur;
                }
                var interpolate = d3.interpolate(this._current, shallowCopy(d));
                this._current = interpolate(0);
                return function(t) {
                    var d2 = interpolate(t);
                    var pos = outerArc.centroid(d2);
                    pos[0] = radius * (midAngle(d2) < Math.PI ? 1 : -1);
                    return "translate("+ pos +")";
                };
            })
            .styleTween("text-anchor", function(d){
                var isNew = !this._current;
                if (isNew) {
                    var cur = shallowCopy(d);
                    this._current = cur;
                }
                var interpolate = d3.interpolate(this._current, shallowCopy(d));
                this._current = interpolate(0);
                return function(t) {
                    var d2 = interpolate(t);
                    return midAngle(d2) < Math.PI ? "start":"end";
                };
            })
            .text(function(d) {
                return (d.data.name);
            });

        text
            .on("click", function(d) {
                if (d.data.children) {
                    currentData = d.data;
                    change();
                }
            });


        text.exit()
            .remove();

        /* ------- SLICE TO TEXT POLYLINES -------*/

        var polyline = svg.select(".lines").selectAll("polyline")
            .data(pie(pieData));

        polyline.enter()
            .append("polyline");

        polyline.transition().duration(transitionDuration)
            .attrTween("points", function(d){
                var isNew = !this._current;
                if (isNew) {
                    var cur = shallowCopy(d);
                    cur.startAngle = 2 * Math.PI;
                    cur.endAngle = 2 * Math.PI;
                    this._current = cur;
                }
                var interpolate = d3.interpolate(this._current, shallowCopy(d));
                this._current = interpolate(0);
                return function(t) {
                    var d2 = interpolate(t);
                    var pos = outerArc.centroid(d2);
                    pos[0] = radius * 0.95 * (midAngle(d2) < Math.PI ? 1 : -1);
                    return [arc.centroid(d2), outerArc.centroid(d2), pos];
                };
            });

        polyline.exit()
            .remove();
    }

    function showTooltip(d) {
        var event = d3.event;
        tooltip.style("left", event.pageX + 10 + "px");
        tooltip.style("top", event.pageY - 25 + "px");
        tooltip.style("display", "inline-block");
        tooltip.html(d.data.name + "<br>" + d.data.size);
    }

    function hideTooltip(){
        tooltip.style("display", "none");
    }


    function iterateParents(callback) {
        for (var p = currentData; p; p = p.parent) {
            callback(p);
        }
    }

    function shallowCopy(d) {
        var cur = {};
        for (var k in d) {
            if (d.hasOwnProperty(k) && k !== "data") {
                cur[k] = d[k];
            }
        }
        return cur;
    }

    function midAngle(d){
        return d.startAngle + (d.endAngle - d.startAngle) / 2;
    }

})();
