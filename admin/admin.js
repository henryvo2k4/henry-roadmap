// =====================================================
// MAP
// =====================================================

const map = L.map("map", {
    zoomControl: false,
    doubleClickZoom: false
}).setView([10.8231, 106.6297], 13);

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{maxZoom:19}
).addTo(map);


// =====================================================
// SUPABASE CONNECTION
// =====================================================

const supabaseUrl = "https://sweqvobmlntyhyeuurfr.supabase.co";
const supabaseKey = "sb_publishable_xsqRVFRoQSh0c9wzwc5vxA_Hw9aj9fF";

const supabaseClient = window.supabase.createClient(
supabaseUrl,
supabaseKey
);


// =====================================================
// LOAD REPORTS
// =====================================================

async function loadReports(){

const {data,error} = await supabaseClient
.from("road_events")
.select("*")
.order("created_at",{ascending:false});

if(error){
console.log("Database error:",error);
return;
}

const container = document.getElementById("reportList");

container.innerHTML = "";

data.forEach(r=>{

const lat = Number(r.lat);
const lng = Number(r.lng);

let card = document.createElement("div");

card.className = "report-card";

card.innerHTML = `

<b>Loại:</b> ${r.type}<br>
<b>Tọa độ:</b> ${lat.toFixed(5)}, ${lng.toFixed(5)}<br>
<b>Status:</b> ${r.status}<br>

${r.image_url ? 
`<img src="https://sweqvobmlntyhyeuurfr.supabase.co/storage/v1/object/public/incident-images/${r.image_url}" class="report-img">` 
: ""}

<div class="buttons">

<button class="view-btn"
onclick="viewIncident(${lat},${lng})">
Xem
</button>

<button class="approve-btn"
onclick="approve(${r.id})">
Duyệt
</button>

<button class="delete-btn"
onclick="removeReport(${r.id})">
Xóa
</button>

</div>

`;

container.appendChild(card);

});

}

loadReports();


// =====================================================
// VIEW INCIDENT
// =====================================================

let viewMarker = null;

function viewIncident(lat,lng){

map.setView([lat,lng],17);

if(viewMarker){
map.removeLayer(viewMarker);
}

viewMarker = L.marker(
[lat,lng],
{
icon:L.icon({
iconUrl:"https://cdn-icons-png.flaticon.com/512/684/684908.png",
iconSize:[40,40],
iconAnchor:[20,40]
})
}
).addTo(map);

}


// =====================================================
// APPROVE
// =====================================================

async function approve(id){

const {error} = await supabaseClient
.from("road_events")
.update({status:"approved"})
.eq("id",id);

if(error){
console.log(error);
}

loadReports();

}


// =====================================================
// DELETE
// =====================================================

async function removeReport(id){

if(!confirm("Xóa báo cáo này?")) return;

const {error} = await supabaseClient
.from("road_events")
.delete()
.eq("id",id);

if(error){
console.log(error);
}

loadReports();

}