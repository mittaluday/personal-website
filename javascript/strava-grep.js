var timeSeriesArray = new Array();
var response;

/* ajax call to strava API to retrieve and massage cycling data */
$.ajax({
    url: "https://www.strava.com/api/v3/athlete/activities?access_token=c379ef8e4211fbe073b1adab4dbb3997fc0e69ac&per_page=150",
    dataType: 'jsonp',
    success: function(data){
        data.forEach(function(datum){
            var thisActivity = new Object();
            thisActivity.distance = +datum.distance/1000;
            thisActivity.avgSpeed = +datum.average_speed * 60 * 60 / 1000 ;
            thisActivity.start_date = d3.time.format("%Y-%m-%dT%H:%M:%SZ").parse(datum.start_date_local);
            timeSeriesArray.push(thisActivity);
        });
        draw(timeSeriesArray);
     }
 });


$.ajax({
    url: "https://www.strava.com/api/v3/athletes/6777185/stats?access_token=c379ef8e4211fbe073b1adab4dbb3997fc0e69ac",
    dataType: 'jsonp',
    success: function(data){
        var summaryObject = new Object();
        summaryObject.totalRideCount = data["all_ride_totals"]["count"];
        summaryObject.totalDistance = data["all_ride_totals"]["distance"];
        drawSummary(summaryObject);
    }
});

function drawSummary(data){
    
    d3.select(".totalRideCount").append("h2").attr("class", "summaryValueContainer").text(data.totalRideCount);
    d3.select(".totalRideCount").append("p").attr("class", "summaryDescriptionContainer").text("Ride Count");
    
    d3.select(".totalDistance").append("h2").attr("class", "summaryValueContainer").text(data.totalDistance/1000);
    d3.select(".totalDistance").append("p").attr("class", "summaryDescriptionContainer").text("Distance in KMs");
}


//function called to draw the char after the data is received by the strava api
function draw(data){
    console.log(data);
    var mediaHeight = $(window).height();
    console.log(mediaHeight);
    /*chart dimensions*/
    var margin = {top:20, right: 30, bottom: 30, left:40},
        width = $("#vis").width() - margin.left - margin.right, 
        height = mediaHeight/2 - margin.top - margin.bottom;
    
    /*grouping data by the date*/
    var aggregatedData = d3.nest()
            .key(function(d) { return d.start_date.getDate()+"/" + d.start_date.getMonth() + "/" + d.start_date.getFullYear();})
            .rollup(function(d) { return { "distance": d3.sum(d, function(g){ return g.distance;}), "avgSpeed": d3.mean(d, function(g) { return g.avgSpeed;}) };})
            .entries(data);
    
   
    aggregatedData.forEach(function(d){
        d.start_date = d3.time.format("%d/%m/%Y").parse(d.key);
        d.start_date.setMonth(d.start_date.getMonth() + 1);
        d.distance = d.values.distance;
        d.averageSpeed = d.values.avgSpeed;
        });
    
    /*Calculating axes extents*/
    var timeExtent = d3.extent(aggregatedData, function(d){return d.start_date});
    
    //console.log(timeExtent);
    /*Defining required scales */
    //x scale
    var x = d3.time.scale();
        x.domain([d3.min(aggregatedData, function(d){return d.start_date}),new Date()]);
        x.range([0, width]);
    
    //y scale
    var y = d3.scale.linear();
        y.domain([0, d3.max(aggregatedData, function(d){return d.averageSpeed})+ 10]);
        y.range([height, 0]);
    
    var scaledRadius = 30/700 * mediaHeight;
    
    //radius scale
    var radius = d3.scale.linear();
        radius.domain([0, d3.max(aggregatedData, function(d){return d.distance})]);
        radius.range([1,scaledRadius]);

    
    /*Defining axes*/
    //x axis
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .ticks(d3.time.month, 1);
    
    //y axis
    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");
    
    
    var tip = d3.tip()
        .attr('class', 'd3-tip')
        .offset([-10, 0])
        .html(function(d) {
            return "<span style='color:#8FB3D1;'>" + d.distance.toPrecision(5) + " Kms</span>";
        })
    
    //appending svg container for bar chart
    var chart = d3.select(".barChart")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    chart.call(tip);
    
    /*adding x axis*/
    chart.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
    
    
    /*adding y axis*/
    chart.append("g")
        .attr("class", "y axis")
        .call(yAxis)
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Age");
    
    //Todo: Hardcoding
    console.log(aggregatedData);
    var chartStartDate = new Date(aggregatedData[aggregatedData.length-1].start_date);
    chartStartDate.setDate(1);
    
    
    
    var updateChart = function(date){
        //filter data upto the given date
        var filteredData = aggregatedData.filter(function(d){
            return d.start_date <= date;
        });
       
        //x domain should change to a date range of that month
        x.domain([chartStartDate, date]);
        
        d3.select(".x.axis")
            .transition()
            .duration(1000)
            .ease("sin-in-out")
            .call(xAxis);
        
        
        //data join
        var dataJoin = chart.selectAll("circle")
            .data(filteredData, function(d){ return d.start_date;});
        
        //add new elements while updating
        var circles = dataJoin.enter()
            .append("circle")
            .on("mouseover", tip.show)
            .on("mouseout", tip.hide)
            .attr("cx", width)
            .attr("cy", function(d) { return y(d.averageSpeed);})
            .transition()
            .duration(1000)
            .ease("sin-in-out")   
            .attr("cx", function(d) {return x(d.start_date);})
            .attr("r", function(d){ return radius(d.distance);})
            .style("opacity", 0.6);

        //update existing elements 
        dataJoin.transition()
            .duration(1000)
            .attr("cx", function(d) { return x(d.start_date);})
            .attr("cy", function(d) { return y(d.averageSpeed);})
            .attr("r", function(d){ return radius(d.distance);})
            .style("opacity", 0.6)


        
        //remove extra elements
        dataJoin.exit().remove();
        
    };  
        
   
    
    var animate = function(){
        //calculating end date of the data
        //var dataFilterDate = d3.min(aggregatedData, function(d){return d.start_date;});
        var dataFilterDate = new Date(aggregatedData[aggregatedData.length-1].start_date);
        dataFilterDate.setDate(1);
    
        var dataEndDate = d3.max(aggregatedData, function(d){return d.start_date});
        var monthInterval = setInterval(function(){

            //traverse to the end of this month
            dataFilterDate.setMonth(dataFilterDate.getMonth() + 1);
            dataFilterDate.setDate(1);
            console.log(dataFilterDate);
            updateChart(dataFilterDate);
            
            //animation stop condition 
            if(dataFilterDate > dataEndDate) {
                clearInterval(monthInterval);
             }
        }, 1000);
    }
    
    animate();
    
    //listener for animate button
    $(".button").click(animate);
    
    
    
    
}
