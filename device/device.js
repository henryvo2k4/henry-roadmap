// 1. Khởi tạo Supabase
const supabaseUrl = "https://sweqvobmlntyhyeuurfr.supabase.co";
const supabaseKey = "sb_publishable_xsqRVFRoQSh0c9wzwc5vxA_Hw9aj9fF";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// 2. Load danh sách thiết bị
async function loadDevices() {
    const { data, error } = await supabaseClient.from("devices").select("*").order("created_at", { ascending: false });
    
    if (error) {
        console.error("Lỗi tải thiết bị:", error);
        return;
    }

    const grid = document.getElementById("deviceGrid");
    grid.innerHTML = "";

    data.forEach(dev => {
        const isFixed = dev.type === 'fixed';
        const typeBadge = isFixed 
            ? `<span class="badge fixed">📍 Cố định</span>` 
            : `<span class="badge mobile">🚌 Di động</span>`;

        // Nếu là Node di động, không hiển thị tọa độ và base
        const detailsHTML = isFixed 
            ? `<p><b>Tọa độ:</b> ${dev.lat}, ${dev.lng}</p>
               <p><b>Base:</b> ${dev.base_distance} cm</p>`
            : `<p><i>Ghi dữ liệu theo vị trí thời gian thực</i></p>`;

        const card = document.createElement("div");
        card.className = "device-card";
        card.onclick = () => openInfoModal(dev);
        card.innerHTML = `
            <h3>${dev.name}</h3>
            <p><b>ID:</b> ${dev.id}</p>
            <p>${typeBadge}</p>
            ${detailsHTML}
        `;
        grid.appendChild(card);
    });
}

// 3. Logic Ẩn/Hiện Form Thêm Thiết bị
function toggleConfigFields() {
    const type = document.getElementById("devType").value;
    const configDiv = document.getElementById("fixedNodeConfig");
    
    // Nếu là fixed thì hiện, mobile thì ẩn
    if (type === 'fixed') {
        configDiv.style.display = "block";
    } else {
        configDiv.style.display = "none";
    }
}

function openAddModal() {
    // Reset form mỗi khi mở
    document.getElementById("devId").value = "";
    document.getElementById("devName").value = "";
    document.getElementById("devType").value = "fixed";
    document.getElementById("devLat").value = "";
    document.getElementById("devLng").value = "";
    document.getElementById("devBase").value = "";
    
    toggleConfigFields(); // Cập nhật lại UI
    document.getElementById("addModal").style.display = "flex";
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
}

// 4. Lưu Thiết Bị Lên Supabase
async function saveDevice() {
    const id = document.getElementById("devId").value;
    const name = document.getElementById("devName").value;
    const type = document.getElementById("devType").value;
    
    if (!id || !name) {
        alert("Vui lòng nhập ID và Tên thiết bị");
        return;
    }

    // Logic kiểm tra: Nếu là di động thì gán null, nếu cố định thì lấy giá trị
    let lat = null, lng = null, base_distance = null;
    
    if (type === 'fixed') {
        lat = parseFloat(document.getElementById("devLat").value) || null;
        lng = parseFloat(document.getElementById("devLng").value) || null;
        base_distance = parseFloat(document.getElementById("devBase").value) || null;
    }

    const { error } = await supabaseClient.from("devices").insert([
        { id, name, type, lat, lng, base_distance }
    ]);

    if (error) {
        alert("Lỗi khi thêm: " + error.message);
        return;
    }

    alert("✅ Thêm thiết bị thành công!");
    closeModal('addModal');
    loadDevices(); // Reload danh sách
}

// 5. Mở Modal Chi tiết & Lịch sử báo cáo
async function openInfoModal(dev) {
    document.getElementById("infoId").innerText = dev.id;
    document.getElementById("infoName").innerText = dev.name;
    
    const isFixed = dev.type === 'fixed';
    const paramsDiv = document.getElementById("infoFixedParams");
    
    // Nếu là cố định thì hiện thông số, di động thì ẩn
    if (isFixed) {
        paramsDiv.style.display = "block";
        document.getElementById("infoCoords").innerText = `${dev.lat || 'N/A'}, ${dev.lng || 'N/A'}`;
        document.getElementById("infoBase").innerText = dev.base_distance || 'Chưa cài đặt';
    } else {
        paramsDiv.style.display = "none";
    }

    document.getElementById("infoModal").style.display = "flex";

    const historyContainer = document.getElementById("historyContainer");
    historyContainer.innerHTML = "⏳ Đang tải dữ liệu...";

    // Truy vấn lịch sử (Vẫn áp dụng chung cho cả cố định và di động)
    const { data, error } = await supabaseClient
        .from("road_events")
        .select("*")
        .eq("device_id", dev.id)
        .order("created_at", { ascending: false })
        .limit(10); 

    if (error) {
        historyContainer.innerHTML = "❌ Lỗi tải lịch sử.";
        return;
    }

    if (data.length === 0) {
        historyContainer.innerHTML = "Thiết bị này chưa có báo cáo nào.";
        return;
    }

    let historyHTML = "";
    data.forEach(event => {
        const time = new Date(event.created_at).toLocaleString("vi-VN");
        // Với node di động, tạo độ sẽ được lưu trực tiếp vào bảng road_events thay vì lấy từ cấu hình
        historyHTML += `
            <div class="history-item">
                <b>⏱ ${time}</b><br>
                Sự cố: ${event.type} | Trạng thái: ${event.status === 'approved' ? '✅ Đã duyệt' : '⏳ Chờ duyệt'}<br>
                Vị trí sự cố: ${parseFloat(event.lat).toFixed(5)}, ${parseFloat(event.lng).toFixed(5)}<br>
                Mô tả: ${event.description || 'Không có'}
            </div>
        `;
    });

    historyContainer.innerHTML = historyHTML;
}

// 6. Chạy khi load trang
loadDevices();