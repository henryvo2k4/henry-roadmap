// =====================================================
// MAP KHỞI TẠO
// =====================================================

const map = L.map("map", {
    zoomControl: false,
    doubleClickZoom: false
}).setView([10.8231, 106.6297], 13);


// =====================================================
// TILE MAP
// =====================================================

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19 }
).addTo(map);

L.control.zoom({
    position: "bottomright"
}).addTo(map);


// =====================================================
// FREEHAND DRAW SYSTEM
// =====================================================

var drawMode = false;
var isDrawing = false;

var drawPoints = [];
var drawLayer = null;

var drawnAreas = [];


// =====================================================
// GEOCODER SEARCH
// =====================================================

const geocoder = L.Control.geocoder({
    placeholder: "🔎 Tìm địa điểm...",
    defaultMarkGeocode: true,
    position: "topleft",
    collapsed: false
}).addTo(map);


// =====================================================
// ICON SCALE
// =====================================================

const baseZoom = 13;
const baseSize = 12;

function getIconSize() {

    const zoom = map.getZoom();
    const scale = Math.pow(1.15, zoom - baseZoom);

    return baseSize * scale;
}


// =====================================================
// ICON DEFINITIONS
// =====================================================

function createIcon(url, size) {
    return L.icon({
        iconUrl: url,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size]
    });
}

const ICONS = {
    pothole: "https://cdn-icons-png.flaticon.com/512/1684/1684423.png",
    flood: "https://cdn-icons-png.flaticon.com/512/1576/1576457.png",
    construction: "https://cdn-icons-png.flaticon.com/512/4930/4930409.png",
    danger: "https://cdn-icons-png.flaticon.com/512/564/564619.png"
};


// =====================================================
// MARKER STORAGE
// =====================================================

let markers = [];
let tempMarker = null;
let reportLatLng = null;


// =====================================================
// DEMO MARKER
// =====================================================

const demoMarker = L.marker(
    [10.8231, 106.6297],
    { icon: createIcon(ICONS.pothole, getIconSize()) }
).addTo(map);

demoMarker.bindPopup("🚧 Phát hiện hố gà");

markers.push(demoMarker);


// =====================================================
// SCALE ICON THEO ZOOM
// =====================================================

map.on("zoomend", function () {

    const size = getIconSize();

    markers.forEach(m => {

        const type = m.incidentType || "pothole";
        m.setIcon(createIcon(ICONS[type], size));

    });

    if (tempMarker) {
        tempMarker.setIcon(createIcon(ICONS.pothole, size));
    }

});


// =====================================================
// DOUBLE CLICK → BÁO CÁO
// =====================================================

map.on("dblclick", function (e) {

    if(drawMode) return;

    reportLatLng = e.latlng;

    if (tempMarker) map.removeLayer(tempMarker);

    tempMarker = L.marker(
        [reportLatLng.lat, reportLatLng.lng],
        { icon: createIcon(ICONS.pothole, getIconSize()) }
    ).addTo(map);

    openReportForm();

});


// =====================================================
// CLICK NGOÀI → XOÁ MARKER TẠM
// =====================================================

map.on("click", function () {

    if(drawMode) return;

    if (tempMarker) {

        map.removeLayer(tempMarker);
        tempMarker = null;
        map.closePopup();

    }

});


// =====================================================
// FORM BÁO CÁO
// =====================================================

function openReportForm() {

    const formHTML = `
    <div style="width:220px">

        <b>🚨 Báo cáo sự cố</b><br><br>

        <select id="incidentType">
            <option value="">-- chọn loại --</option>
            <option value="pothole">🚧 Hố gà</option>
            <option value="flood">🌊 Ngập nước</option>
            <option value="construction">🏗️ Thi công</option>
            <option value="danger">⚠️ Nguy hiểm</option>
        </select>

        <br><br>

        <input type="file" id="incidentImage">

        <br><br>

        <button onclick="submitReport()">Gửi báo cáo</button>

    </div>
    `;

    L.popup()
        .setLatLng(reportLatLng)
        .setContent(formHTML)
        .openOn(map);
}


// =====================================================
// SUBMIT REPORT
// =====================================================

function submitReport() {

    const type = document.getElementById("incidentType").value;

    if (!type) {
        alert("Hãy chọn loại sự cố");
        return;
    }

    const fileInput = document.getElementById("incidentImage");

    let imageURL = "";

    if (fileInput.files.length > 0) {
        imageURL = URL.createObjectURL(fileInput.files[0]);
    }

    let popupText = "<b>Sự cố:</b> " + type;

    if (imageURL) {
        popupText += `<br><img src="${imageURL}" width="120">`;
    }

    const size = getIconSize();
    const icon = createIcon(ICONS[type], size);

    tempMarker.setIcon(icon);
    tempMarker.incidentType = type;
    tempMarker.bindPopup(popupText);

    tempMarker._icon.classList.add("marker-bounce");

    markers.push(tempMarker);

    tempMarker = null;

    map.closePopup();

}


// =====================================================
// GPS LOCATION
// =====================================================

let userMarker = null;
let userLocation = null;

document.getElementById("gpsBtn").onclick = function () {
    map.locate({ setView: true, maxZoom: 16 });
};

map.on("locationfound", function (e) {

    userLocation = e.latlng;

    if (userMarker) map.removeLayer(userMarker);

    userMarker = L.marker(e.latlng)
        .addTo(map)
        .bindPopup("📍 Bạn đang ở đây")
        .openPopup();

    L.circle(e.latlng, {
        radius: e.accuracy
    }).addTo(map);

});


// =====================================================
// ROUTING SYSTEM
// =====================================================

let routingControl = null;
let selectingRoute = false;

let startMarker = null;
let endMarker = null;

let startPoint = null;
let endPoint = null;


// =====================================================
// ROUTE ICONS
// =====================================================

function createStartIcon() {
    return L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });
}

function createEndIcon() {
    return L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/149/149060.png",
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });
}


// =====================================================
// ROUTE BUTTON
// =====================================================

document.getElementById("routeBtn").onclick = function () {

    document.getElementById("dashboard")
        .classList.remove("route-active");

    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);

    startMarker = null;
    endMarker = null;

    startPoint = null;
    endPoint = null;

    selectingRoute = true;

    alert(
        "🧭 Chế độ chỉ đường\n\n" +
        "1️⃣ Click chọn điểm bắt đầu\n" +
        "2️⃣ Click chọn điểm kết thúc"
    );

};


// =====================================================
// CHỌN ĐIỂM ROUTE
// =====================================================

map.on("click", function (e) {

    if(drawMode) return;

    if (!selectingRoute) return;

    if (!startPoint) {

        startPoint = userLocation || e.latlng;

        startMarker = L.marker(startPoint, {
            icon: createStartIcon()
        }).addTo(map)
            .bindPopup("🚦 Điểm bắt đầu")
            .openPopup();

        return;
    }

    if (!endPoint) {

        endPoint = e.latlng;

        endMarker = L.marker(endPoint, {
            icon: createEndIcon()
        }).addTo(map)
            .bindPopup("🏁 Điểm kết thúc")
            .openPopup();

        createRoute(startPoint, endPoint);

        selectingRoute = false;

    }

});


// =====================================================
// TẠO ROUTE
// =====================================================

function createRoute(start, end) {

    if (routingControl) {
        map.removeControl(routingControl);
    }

    routingControl = L.Routing.control({

        waypoints: [
            L.latLng(start.lat, start.lng),
            L.latLng(end.lat, end.lng)
        ],

        routeWhileDragging: false,

        show: false,

        lineOptions: {
            styles: [{ color: "#2b8cff", weight: 7 }]
        },

        createMarker: function () { return null }

    }).addTo(map);

    routingControl.on("routesfound", function (e) {

        const route = e.routes[0];

        document.getElementById("dashboard")
            .classList.add("route-active");

        showInstructions(route.instructions);

    });

}


// =====================================================
// HIỂN THỊ HƯỚNG DẪN
// =====================================================

function showInstructions(instructions) {

    let html = "";

    instructions.forEach(step => {

        html += `
        <p>
        ${step.text}
        <br>
        <span style="color:gray;font-size:12px">
        ${Math.round(step.distance)} m
        </span>
        </p>
        `;

    });

    document.getElementById("routeSteps").innerHTML = html;

}


// =====================================================
// POINT IN POLYGON
// =====================================================

function isPointInPolygon(point, polygon) {

    let x = point.lng;
    let y = point.lat;

    let inside = false;

    let vs = polygon.getLatLngs()[0];

    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {

        let xi = vs[i].lng, yi = vs[i].lat;
        let xj = vs[j].lng, yj = vs[j].lat;

        let intersect =
            ((yi > y) != (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;

    }

    return inside;

}


// =====================================================
// UPDATE DASHBOARD
// =====================================================

function updateDashboard(pothole, flood, construction, danger) {

    const total = pothole + flood + construction + danger;

    document.getElementById("potholeRoute").innerText = pothole;
    document.getElementById("floodRoute").innerText = flood;
    document.getElementById("warningRoute").innerText = total;

}


// =====================================================
// DRAW BUTTON
// =====================================================

document.getElementById("drawBtn").onclick = function(){

    drawMode = !drawMode;

    if(drawMode){

        this.innerText = "❌ Huỷ vẽ";

        // tắt kéo bản đồ
        map.dragging.disable();

        alert(
        "✏️ Chế độ khoanh vùng\n\n"+
        "• Nhấn giữ chuột để vẽ\n"+
        "• Thả chuột để hoàn thành vùng\n"+
        "• Có thể vẽ nhiều khu vực"
        );

    }else{

        this.innerText = "✏️ Khoanh vùng";

        // bật lại kéo bản đồ
        map.dragging.enable();

        clearAllDrawings();

    }

};


// =====================================================
// FREEHAND DRAW EVENTS
// =====================================================

map.on("mousedown", function(e){

    if(!drawMode) return;

    isDrawing = true;

    drawPoints = [e.latlng];

    if(drawLayer){
        map.removeLayer(drawLayer);
    }

});

map.on("mousemove", function(e){

    if(!isDrawing) return;

    const last = drawPoints[drawPoints.length-1];

    if(!last || last.distanceTo(e.latlng) > 5){
        drawPoints.push(e.latlng);
    }

    if(drawLayer){
        map.removeLayer(drawLayer);
    }

    drawLayer = L.polyline(drawPoints,{
        color:"#ff5500",
        weight:3
    }).addTo(map);

});

map.on("mouseup", function(){

    if(!isDrawing) return;

    isDrawing = false;

    if(drawPoints.length < 3){
        return;
    }

    drawPoints.push(drawPoints[0]);

    if(drawLayer){
        map.removeLayer(drawLayer);
    }

    var polygon = L.polygon(drawPoints,{
        color:"#ff5500",
        weight:2,
        fillOpacity:0.15
    }).addTo(map);

    drawnAreas.push(polygon);

    calculateAllAreas();

});


// =====================================================
// TÍNH TỔNG CẢNH BÁO TRONG CÁC VÙNG
// =====================================================

function calculateAllAreas(){

    var pothole=0;
    var flood=0;
    var construction=0;
    var danger=0;

    markers.forEach(function(m){

        var pos = m.getLatLng();
        var insideAnyArea = false;

        drawnAreas.forEach(function(area){

            if(isPointInPolygon(pos,area)){
                insideAnyArea = true;
            }

        });

        if(insideAnyArea){

            var type = m.incidentType || "pothole";

            if(type==="pothole") pothole++;
            if(type==="flood") flood++;
            if(type==="construction") construction++;
            if(type==="danger") danger++;

        }

    });

    updateDashboard(pothole,flood,construction,danger);

    document.getElementById("dashboard")
    .classList.remove("route-active");

}


// =====================================================
// CLEAR ALL DRAWINGS
// =====================================================

function clearAllDrawings(){

    drawnAreas.forEach(function(area){
        map.removeLayer(area);
    });

    drawnAreas = [];

    if(drawLayer){
        map.removeLayer(drawLayer);
    }

    updateDashboard(0,0,0,0);

}


// =====================================================
// SEARCH → KHOANH VÙNG
// =====================================================

geocoder.on("markgeocode", function (e) {

    const bbox = e.geocode.bbox;

    const bounds = L.latLngBounds(bbox);

    const rect = L.rectangle(bounds, {
        color: "#2b8cff",
        weight: 2
    }).addTo(map);

    checkIncidentsInArea(rect);

});


// =====================================================
// Database Testing with Supabase
// =====================================================

// 1. Thông tin kết nối Supabase
const supabaseUrl = "https://sweqvobmlntyhyeuurfr.supabase.co";
const supabaseKey = "sb_publishable_xsqRVFRoQSh0c9wzwc5vxA_Hw9aj9fF";

// 2. Tạo client kết nối database
const supabaseClient = window.supabase.createClient(
  supabaseUrl,
  supabaseKey
);

// 3. Hàm test đọc dữ liệu từ bảng
async function testDB() {

  const { data, error } = await supabaseClient
    .from("road_events")
    .select("*");

  console.log("DATA:", data);
  console.log("ERROR:", error);

}

// 4. Chạy test
testDB();