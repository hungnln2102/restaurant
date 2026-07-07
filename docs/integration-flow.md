# Thiết kế Luồng liên kết Sản phẩm - Định lượng - Kho hàng

## 1. Mục tiêu và Tổng quan
Luồng này liên kết 3 module hiện có trong hệ thống (`Product Sales Plan`, `Product Portioning` và `Warehouse/Stock`) để tự động hóa việc tính toán nhu cầu nguyên vật liệu hàng ngày và đưa ra cảnh báo tồn kho.

Ba module tham gia vào luồng gồm:
1. **Quản lý định lượng (Portioning)**: Khai báo một sản phẩm/món ăn (Menu Product) cấu thành từ những nguyên vật liệu (Stock Product/Ingredient) nào, số lượng (quantity) bao nhiêu cho mỗi phần.
2. **Quản lý sản phẩm vận hành (Product Sales Plan)**: Nơi người dùng đặt kế hoạch số lượng sản phẩm bán ra trong ngày (`salesTarget`).
3. **Quản lý kho (Stock Balance)**: Nơi tổng hợp số lượng nguyên vật liệu đang tồn (`current_stock_balance`).

## 2. Chi tiết Luồng hoạt động

### Bước 1: Quản lý định lượng & Khởi tạo nguyên liệu
- Người dùng thiết lập công thức món ăn (định lượng) trong **Quản lý định lượng**.
- **Yêu cầu mới**: Nếu nguyên liệu cần dùng chưa có trong kho, cho phép người dùng **trực tiếp import nguyên liệu mới vào kho** (Tạo Stock Product mới và khởi tạo Lô hàng/Stock Lot ban đầu) ngay từ giao diện cấu hình định lượng, thay vì phải quay lại màn hình Kho hàng để tạo trước.

### Bước 2: Tính toán nhu cầu nguyên liệu hàng ngày
- Khi người dùng thiết lập số lượng sản phẩm cần bán trong ngày (`salesTarget`) trong module **Kế hoạch bán hàng (Product Sales Plan)**.
- Hệ thống tự động kích hoạt tính toán: 
  `Nhu cầu nguyên liệu (ngày) = Kế hoạch bán (salesTarget) × Định lượng nguyên liệu/phần (portion quantity)`.
- Nếu nguyên liệu đó nằm trong nhiều sản phẩm khác nhau, hệ thống sẽ **cộng dồn** toàn bộ nhu cầu của nguyên liệu đó từ tất cả các sản phẩm có trong kế hoạch bán.

### Bước 3: So sánh Kho & Đổi trạng thái (Cảnh báo tồn kho)
- Sau khi có được tổng nhu cầu nguyên liệu trong ngày, hệ thống sẽ đối chiếu với **Tồn kho hiện tại** (tổng số lượng tồn hợp lệ chưa hết hạn của nguyên liệu đó trong kho).
- Hệ thống sẽ gắn một trạng thái/cảnh báo (Status) trực tiếp vào bảng danh sách nguyên vật liệu kho để nhân viên có thể xem nhanh:
  - **Còn đủ (Sufficient)**: Tồn kho >= Nhu cầu nguyên liệu.
  - **Sắp hết hàng (Low Stock)**: Tồn kho < Nhu cầu, nhưng vẫn còn số dư trên 0 (Hoặc Tồn kho gần chạm ngưỡng Cảnh báo tối thiểu).
  - **Cần nhập thêm (Needs Restock)**: Tồn kho = 0 hoặc lượng thiếu hụt cần mua lớn.
- Bổ sung trường thông tin: **Số lượng cần nhập thêm** = `Nhu cầu trong ngày - Tồn kho hiện tại` (nếu Nhu cầu > Tồn kho, ngược lại là 0).

## 3. Thay đổi kỹ thuật đề xuất (Technical Implementation)

### 3.1. Về phía Backend
1. **API Tính toán nhu cầu (Daily Material Demand API)**
   - Khởi tạo Endpoint mới, ví dụ: `GET /api/inventory/daily-material-demand`
   - Logic: 
     - Lấy tất cả `menu_products` đang có trong Kế hoạch (`salesPlans` trạng thái `active`).
     - Inner join với bảng `menu_product_components` để tính tổng số `quantity` nguyên liệu nhân với `salesTarget`.
     - Inner join tiếp với `stock_balance` để lấy số tồn hiện tại.
     - Trả về danh sách Material kèm `demand_quantity`, `current_stock`, `missing_quantity`, `status`.

2. **Cập nhật Inventory Overview / Stock Balance**
   - Trong `stockBalanceRoute.mjs` / `getStockBalance.mjs`, tích hợp việc tính toán chéo kế hoạch bán hàng ở trên để gán flag cảnh báo cho từng Item (`Sufficient`, `Low Stock`, `Needs Restock`).

3. **Cải tiến Portioning Creation**
   - Trong luồng tạo/chỉnh sửa định lượng (`menu_product_components`), hỗ trợ payload `createIngredientIfNotExist` để tự động gọi logic tạo `stock_product` mới.

### 3.2. Về phía Frontend
1. **Màn hình Kế hoạch & Kho (Dashboard/Inventory view)**
   - Bổ sung một Widget hoặc Table thể hiện "Dự báo nguyên vật liệu hôm nay".
   - Hiển thị danh sách các nguyên liệu kèm thẻ trạng thái (Tag màu: Xanh lá = Còn đủ, Cam = Sắp hết, Đỏ = Cần nhập thêm).
   - Có cột tính toán: "Cần nhập thêm: x kg/lit".
2. **Màn hình Quản lý định lượng (ProductsPortioningView.jsx)**
   - Nút "Thêm nhanh nguyên vật liệu mới" ở dropdown chọn nguyên liệu. Modal nhỏ hiện lên cho phép điền tên, đơn vị, danh mục và tự động đẩy thẳng vào kho `stock_products`.

## 4. Các câu hỏi cần chốt trước khi Code
1. **Chu kỳ cập nhật:** Tình trạng "Còn đủ / Sắp hết / Cần nhập" có cần update realtime mỗi khi có hóa đơn mua hàng trừ kho thực tế không, hay chỉ cần chạy mỗi đầu ngày?
2. **Quản lý mua sắm:** Bạn có muốn khi bấm vào "Cần nhập thêm", hệ thống tự động sinh ra một "Đơn đặt hàng nhà cung cấp (Purchase Order / Stock Receipt)" với số lượng khuyến nghị bằng đúng phần bị thiếu không?
3. **Màn hình hiển thị:** Bảng đối chiếu Nhu cầu vs Kho này sẽ được đặt ở giao diện Quản lý Kho (Inventory) hay làm một tab riêng biệt "Kế hoạch nhập kho hàng ngày"?
