// ===== MAP =====

var map = L.map('map', {
    zoomControl:false,
    doubleClickZoom:false
}).setView([10.8231,106.6297],13);



// ===== TILE =====

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
maxZoom:19
}).addTo(map);

L.control.zoom({
position:'bottomright'
}).addTo(map);



// ===== THIẾT LẬP SCALE =====

var baseZoom = 13;
var baseSize = 12;



// ===== ICON =====

function createPotholeIcon(size){

return L.icon({

iconUrl:'https://cdn-icons-png.flaticon.com/512/1684/1684423.png',

iconSize:[size,size],

iconAnchor:[size/2,size],

popupAnchor:[0,-size]

});

}

function createIcon(url,size){

return L.icon({

iconUrl:url,
iconSize:[size,size],
iconAnchor:[size/2,size],
popupAnchor:[0,-size]

});

}

var ICONS = {

pothole:'https://cdn-icons-png.flaticon.com/512/1684/1684423.png',

flood:'https://cdn-icons-png.flaticon.com/512/1576/1576457.png',

construction:'https://cdn-icons-png.flaticon.com/512/4930/4930409.png',

danger:'https://cdn-icons-png.flaticon.com/512/564/564619.png'

};


// ===== DANH SÁCH MARKER =====

var markers=[];



// ===== MARKER TẠM =====

var tempMarker = null;
var reportLatLng = null;



// ===== TÍNH SIZE ICON THEO ZOOM =====

function getIconSize(){

var zoom = map.getZoom();

var scale = Math.pow(1.15, zoom - baseZoom);

return baseSize * scale;

}



// ===== MARKER DEMO BAN ĐẦU =====

var marker = L.marker(
[10.8231,106.6297],
{icon:createPotholeIcon(getIconSize())}
).addTo(map);

marker.bindPopup("🚧 Phát hiện hố gà");

markers.push(marker);



// ===== DOUBLE CLICK BÁO CÁO =====

map.on("dblclick",function(e){

reportLatLng = e.latlng;


// nếu đã có marker tạm thì xoá
if(tempMarker){
map.removeLayer(tempMarker);
}


tempMarker = L.marker(
[reportLatLng.lat,reportLatLng.lng],
{icon:createPotholeIcon(getIconSize())}
).addTo(map);


openReportForm();

});



// ===== CLICK NGOÀI → XOÁ MARKER TẠM =====

map.on("click",function(){

if(tempMarker){

map.removeLayer(tempMarker);

tempMarker=null;

map.closePopup();

}

});



// ===== SCALE ICON THEO ZOOM =====

map.on("zoomend",function(){

var size = getIconSize();

markers.forEach(function(m){

var type = m.incidentType || "pothole";

var icon = createIcon(ICONS[type],size);

m.setIcon(icon);

});

if(tempMarker){

var icon = createIcon(ICONS["pothole"],size);

tempMarker.setIcon(icon);

}

});



// ===== FORM BÁO CÁO =====

function openReportForm(){

var formHTML = `

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



// ===== GỬI BÁO CÁO =====

function submitReport(){

var type = document.getElementById("incidentType").value;

if(type===""){
alert("Hãy chọn loại sự cố");
return;
}


var fileInput = document.getElementById("incidentImage");

var imageURL="";

if(fileInput.files.length>0){

imageURL = URL.createObjectURL(fileInput.files[0]);

}


var popupText="<b>Sự cố:</b> "+type;


if(imageURL!==""){
popupText+=`<br><img src="${imageURL}" width="120">`;
}


var size = getIconSize();

var icon = createIcon(ICONS[type],size);

tempMarker.setIcon(icon);

tempMarker.incidentType = type;

tempMarker.bindPopup(popupText);

tempMarker._icon.classList.add("marker-bounce");


markers.push(tempMarker);


tempMarker=null;


map.closePopup();

}