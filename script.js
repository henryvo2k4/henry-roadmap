// =====================================================
// MAP KHỞI TẠO
// =====================================================

const map = L.map("map", {
    zoomControl: false,
    doubleClickZoom: false
}).setView([10.8231, 106.6297], 13);

map.getContainer().style.touchAction = "none";

map.getContainer().addEventListener(
    "touchmove",
    function (e) {
        if (drawMode) {
            e.preventDefault();
        }
    },
    { passive: false }
);


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
    "Hố gà": "https://cdn-icons-png.flaticon.com/512/1684/1684423.png",
    "Lũ lụt": "https://cdn-icons-png.flaticon.com/512/1576/1576457.png",
    "Thi công": "https://cdn-icons-png.flaticon.com/512/4930/4930409.png",
    "Nguy hiểm": "https://cdn-icons-png.flaticon.com/512/564/564619.png"
};


// =====================================================
// MARKER STORAGE
// =====================================================

let markers = [];
let tempMarker = null;
let reportLatLng = null;


// =====================================================
// SCALE ICON THEO ZOOM
// =====================================================

map.on("zoomend", function () {

    const size = getIconSize();

    markers.forEach(m => {

        const type = m.incidentType || "Hố gà";
        m.setIcon(createIcon(ICONS[type], size));

    });

    if (tempMarker) {
        tempMarker.setIcon(createIcon(ICONS["Hố gà"], size));
    }

});


// =====================================================
// DOUBLE CLICK → BÁO CÁO
// =====================================================

map.on("dblclick", async function (e) {

    if (drawMode) return;

    const snapped = await snapToRoad(e.latlng.lat, e.latlng.lng);

    reportLatLng = snapped;

    if (tempMarker) map.removeLayer(tempMarker);

    tempMarker = L.marker(
        [snapped.lat, snapped.lng],
        { icon: createIcon(ICONS["Hố gà"], getIconSize()) }
    ).addTo(map);

    openReportForm();

});


// =====================================================
// CLICK NGOÀI → XOÁ MARKER TẠM
// =====================================================

map.on("click", function () {

    if (drawMode) return;

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
            <option value="Hố gà">🚧 Hố gà</option>
            <option value="Lũ lụt">🌊 Ngập nước</option>
            <option value="Thi công">🏗️ Thi công</option>
            <option value="Nguy hiểm">⚠️ Nguy hiểm</option>
        </select>

        <br><br>

        <textarea 
            id="incidentDesc"
            placeholder="Mô tả sự cố..."
            style="width:100%;height:60px"
        ></textarea>

        <br><br>

        <input 
            type="file" 
            id="incidentImage" 
            multiple 
            accept="image/*"
        ><small>Tối đa 5 ảnh</small>

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

async function submitReport() {

    const type = document.getElementById("incidentType").value;
    const description = document.getElementById("incidentDesc").value;

    if (!type) {
        alert("Hãy chọn loại sự cố");
        return;
    }

    const fileInput = document.getElementById("incidentImage");

    let imageURLs = [];

    if (fileInput.files.length > 0) {

        if (fileInput.files.length > 5) {
            alert("Chỉ được tối đa 5 ảnh");
            return;
        }

        for (const file of fileInput.files) {

            const fileName = Date.now() + "_" + file.name;

            const { error } = await supabaseClient
                .storage
                .from("road-images")
                .upload(fileName, file);

            if (error) {
                console.log("Upload lỗi:", error);
                continue;
            }

            const { data } = supabaseClient
                .storage
                .from("road-images")
                .getPublicUrl(fileName);

            imageURLs.push(data.publicUrl);

        }

    }

    // =====================================================
    // LƯU DATABASE
    // =====================================================

    const { error } = await supabaseClient
        .from("road_events")
        .insert([
            {
                lat: reportLatLng.lat,
                lng: reportLatLng.lng,
                type: type,
                description: description,
                image_url: JSON.stringify(imageURLs),
                status: "pending",
                created_at: new Date().toISOString()
            }
        ]);

    if (error) {
        console.log("Lỗi lưu DB:", error);
        alert("❌ Không gửi được báo cáo");
        return;
    }

    alert("✅ Báo cáo đã gửi, chờ admin duyệt");

    map.removeLayer(tempMarker);
    tempMarker = null;

    map.closePopup();

}


async function loadIncidents() {

    const { data, error } = await supabaseClient
        .from("road_events")
        .select("*")
        .eq("status", "approved");

    if (error) {
        console.log(error);
        return;
    }

    data.forEach(row => {

        const size = getIconSize();

        const icon = createIcon(ICONS[row.type], size);

        const marker = L.marker(
            [row.lat, row.lng],
            { icon: icon }
        ).addTo(map);

        marker.incidentType = row.type;

        let popup = "<b>Sự cố:</b> " + row.type;

        if (row.created_at) {

            const date = new Date(row.created_at);

            const timeString =
                date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                + " • " +
                date.toLocaleDateString("vi-VN");

            popup += "<br><b>Thời gian:</b> " + timeString;

        }

        if (row.description) {
            popup += "<br><b>Mô tả:</b> " + row.description;
        }

        if (row.image_url) {

            let images = [];

            try {
                images = JSON.parse(row.image_url);
            } catch {
                images = [row.image_url];
            }

            popup += "<br>";

            images.forEach(img => {

                popup += `
        <img 
            src="${img}" 
            width="80"
            style="margin:3px;border-radius:4px"
        >
        `;

            });

        }

        marker.bindPopup(popup);

        markers.push(marker);

    });

    calculateAllIncidents();

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

    if (selectingRoute || routingControl) {
        cancelRoute();
        this.innerText = "🧭 Chỉ đường";
        return;
    }

    this.innerText = "❌ Huỷ chỉ đường";

    selectingRoute = true;

    alert(
        "🧭 Chế độ chỉ đường\n\n" +
        "1️⃣ Click chọn điểm bắt đầu\n" +
        "2️⃣ Click chọn điểm kết thúc"
    );

};


// =====================================================
// SNAP TO ROAD (điều chỉnh điểm người dùng chọn cho chính xác trên đường)
// =====================================================

async function snapToRoad(lat, lng) {

    const url = `https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.waypoints && data.waypoints.length > 0) {

        const snapped = data.waypoints[0].location;

        return {
            lat: snapped[1],
            lng: snapped[0]
        };

    }

    return { lat, lng };
}


// =====================================================
// CHỌN ĐIỂM ROUTE
// =====================================================

map.on("click", function (e) {

    if (drawMode) return;

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

        const coords = route.coordinates;

        calculateRouteIncidents(coords);

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
// DISTANCE TO SEGMENT (để tính khoảng cách từ điểm đến đường đi)
// =====================================================
function distanceToSegment(p, p1, p2) {

    const x = p.lng;
    const y = p.lat;

    const x1 = p1.lng;
    const y1 = p1.lat;

    const x2 = p2.lng;
    const y2 = p2.lat;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;

    let param = -1;

    if (len_sq !== 0) {
        param = dot / len_sq;
    }

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    }
    else if (param > 1) {
        xx = x2;
        yy = y2;
    }
    else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;

    return Math.sqrt(dx * dx + dy * dy);
}

// =====================================================
// TÍNH CÁC SỰ CỐ TRÊN TUYẾN ĐƯỜNG
// =====================================================
function calculateRouteIncidents(routeCoords) {

    let pothole = 0;
    let flood = 0;
    let construction = 0;
    let danger = 0;

    const buffer = 0.0001; // ~10m

    markers.forEach(m => {

        const pos = m.getLatLng();
        let nearRoute = false;

        for (let i = 0; i < routeCoords.length - 1; i++) {

            const d = distanceToSegment(
                pos,
                routeCoords[i],
                routeCoords[i + 1]
            );

            if (d < buffer) {
                nearRoute = true;
                break;
            }

        }

        if (nearRoute) {

            const type = m.incidentType;

            if (type === "Hố gà") pothole++;
            if (type === "Lũ lụt") flood++;
            if (type === "Thi công") construction++;
            if (type === "Nguy hiểm") danger++;

        }

    });

    updateDashboard(pothole, flood, construction, danger);

}

// =====================================================
// CANCEL ROUTE
// =====================================================

function cancelRoute() {

    selectingRoute = false;

    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    if (startMarker) {
        map.removeLayer(startMarker);
        startMarker = null;
    }

    if (endMarker) {
        map.removeLayer(endMarker);
        endMarker = null;
    }

    startPoint = null;
    endPoint = null;

    document.getElementById("dashboard")
        .classList.remove("route-active");

}


// =====================================================
// UPDATE DASHBOARD
// =====================================================

function updateDashboard(pothole, flood, construction, danger) {

    const total = pothole + flood + construction + danger;

    document.getElementById("potholeRoute").innerText = pothole;
    document.getElementById("floodRoute").innerText = flood;
    document.getElementById("constructionRoute").innerText = construction;
    document.getElementById("dangerRoute").innerText = danger;
    document.getElementById("warningRoute").innerText = total;

}


// =====================================================
// DRAW BUTTON
// =====================================================

document.getElementById("drawBtn").onclick = function () {

    drawMode = !drawMode;

    if (drawMode) {

        this.innerText = "❌ Huỷ vẽ";

        // tắt kéo bản đồ
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();


        alert(
            "✏️ Chế độ khoanh vùng\n\n" +
            "• Nhấn giữ chuột để vẽ\n" +
            "• Thả chuột để hoàn thành vùng\n" +
            "• Có thể vẽ nhiều khu vực"
        );

    } else {

        this.innerText = "✏️ Khoanh vùng";

        // bật lại kéo bản đồ
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();

        clearAllDrawings();

    }

};


// =====================================================
// FREEHAND DRAW EVENTS
// =====================================================

map.on("mousedown", function (e) {

    if (!drawMode) return;

    isDrawing = true;

    drawPoints = [e.latlng];

    if (drawLayer) {
        map.removeLayer(drawLayer);
    }

});


map.on("mousemove", function (e) {

    if (!isDrawing) return;

    const last = drawPoints[drawPoints.length - 1];

    if (!last || last.distanceTo(e.latlng) > 5) {
        drawPoints.push(e.latlng);
    }

    if (drawLayer) {
        map.removeLayer(drawLayer);
    }

    drawLayer = L.polyline(drawPoints, {
        color: "#ff5500",
        weight: 3
    }).addTo(map);

});

map.on("mouseup", function () {

    if (!isDrawing) return;

    isDrawing = false;

    if (drawPoints.length < 3) {
        return;
    }

    drawPoints.push(drawPoints[0]);

    if (drawLayer) {
        map.removeLayer(drawLayer);
    }

    var polygon = L.polygon(drawPoints, {
        color: "#ff5500",
        weight: 2,
        fillOpacity: 0.15
    }).addTo(map);

    drawnAreas.push(polygon);

    calculateAllAreas();

});

// =====================================================
// TOUCH EVENTS
// =====================================================


map.on("touchstart", function (e) {

    if (!drawMode) return;

    if (e.originalEvent.touches.length > 1) return;

    e.originalEvent.preventDefault();

    isDrawing = true;

    const latlng = map.mouseEventToLatLng(e.originalEvent.touches[0]);

    drawPoints = [latlng];

    if (drawLayer) {
        map.removeLayer(drawLayer);
    }

});

map.on("touchmove", function (e) {

    if (!isDrawing) return;

    e.originalEvent.preventDefault();

    const latlng = map.mouseEventToLatLng(e.originalEvent.touches[0]);

    const last = drawPoints[drawPoints.length - 1];

    if (!last || last.distanceTo(latlng) > 5) {
        drawPoints.push(latlng);
    }

    if (drawLayer) {
        map.removeLayer(drawLayer);
    }

    drawLayer = L.polyline(drawPoints, {
        color: "#ff5500",
        weight: 3
    }).addTo(map);

});

map.on("touchend", function (e) {

    if (!isDrawing) return;

    isDrawing = false;

    const touch = e.originalEvent.changedTouches[0];

    const latlng = map.mouseEventToLatLng(touch);

    drawPoints.push(latlng); // thêm điểm cuối

    if (drawPoints.length < 3) return;

    drawPoints.push(drawPoints[0]); // đóng polygon

    if (drawLayer) {
        map.removeLayer(drawLayer);
    }

    const polygon = L.polygon(drawPoints, {
        color: "#ff5500",
        weight: 2,
        fillOpacity: 0.15
    }).addTo(map);

    drawnAreas.push(polygon);

    calculateAllAreas();

});

// =====================================================
// TÍNH TỔNG CẢNH BÁO TRÊN TOÀN BẢN ĐỒ
// =====================================================

function calculateAllIncidents() {

    let pothole = 0;
    let flood = 0;
    let construction = 0;
    let danger = 0;

    markers.forEach(m => {

        const type = m.incidentType || "Hố gà";

        if (type === "Hố gà") pothole++;
        if (type === "Lũ lụt") flood++;
        if (type === "Thi công") construction++;
        if (type === "Nguy hiểm") danger++;

    });

    updateDashboard(pothole, flood, construction, danger);

}


// =====================================================
// TÍNH TỔNG CẢNH BÁO TRONG CÁC VÙNG
// =====================================================

function calculateAllAreas() {

    var pothole = 0;
    var flood = 0;
    var construction = 0;
    var danger = 0;

    markers.forEach(function (m) {

        var pos = m.getLatLng();
        var insideAnyArea = false;

        drawnAreas.forEach(function (area) {

            if (isPointInPolygon(pos, area)) {
                insideAnyArea = true;
            }

        });

        if (insideAnyArea) {

            var type = m.incidentType || "Hố gà";

            if (type === "Hố gà") pothole++;
            if (type === "Lũ lụt") flood++;
            if (type === "Thi công") construction++;
            if (type === "Nguy hiểm") danger++;

        }

    });

    updateDashboard(pothole, flood, construction, danger);

    document.getElementById("dashboard")
        .classList.remove("route-active");

}


// =====================================================
// CLEAR ALL DRAWINGS
// =====================================================

function clearAllDrawings() {

    drawnAreas.forEach(function (area) {
        map.removeLayer(area);
    });

    drawnAreas = [];

    if (drawLayer) {
        map.removeLayer(drawLayer);
    }

    calculateAllIncidents();

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

    drawnAreas.push(rect);
    calculateAllAreas();

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

// 4. Chạy test
loadIncidents();