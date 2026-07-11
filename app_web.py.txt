import streamlit as st
import datetime
import time

# НАЛАШТУВАННЯ СТРАНИЦІ БРАУЗЕРА
st.set_page_config(page_title="КУПРА&СЕАТ Центр Київ", layout="wide")

# Стилізація інтерфейсу під світлий дилерський стандарт КУПРА
st.markdown("""
    <style>
    .stApp { background-color: #f5f6fa; }
    h1, h2, h3 { color: #111827 !important; }
    .stButton>button { border-radius: 6px; font-weight: bold; }
    </style>
""", unsafe_allow_html=True)

# ЗАЛІЗОБЕТОННА ПАМ'ЯТЬ СЕРВЕРА (НЕ СКИДАЄТЬСЯ ПРИ ОНОВЛЕННІ)
@st.cache_resource
def get_global_database():
    return [
        {"id": 1, "car_number": "AA 1234 BB", "model": "Cupra Formentor", "request": "ЗН-00124", "area": "Сервіс", "post": "Підйомник 1", "start_time": (datetime.datetime.now() - datetime.timedelta(hours=2, minutes=15)).isoformat(), "end_time": None, "wh_status": "Новий", "wh_end_time": None, "status": "В ремонті"},
        {"id": 2, "car_number": "BC 7788 CA", "model": "SEAT Leon", "request": "ЗН-00125", "area": "Сервіс", "post": "Не призначено", "start_time": (datetime.datetime.now() + datetime.timedelta(hours=1)).isoformat(), "end_time": None, "wh_status": "Новий", "wh_end_time": None, "status": "Запис"}
    ]

# Підключаємо пам'ять до поточної сторінки
global_db = get_global_database()

post_mechanics = {
    "Підйомник 1": "Коротунов О.", "Підйомник 2": "Хрунов Д.", "Підйомник 3": "---",
    "Підйомник 4": "Тарасенко А.", "Кузовний": "Кирилюк С. / Вайгель Д.", "Мийка": "Юшко С. / Гук М."
}

# ==================== ЕКРАН АВТОРТИЗАЦІЇ (CUPRA DARK) ====================
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False

if not st.session_state.authenticated:
    st.markdown("<style>.stApp { background-color: #11161b !important; } label { color: white !important; } input { background-color: #1a2129 !important; color: white !important; border: 1px solid #252e38 !important; }</style>", unsafe_allow_html=True)
    st.title("КУПРА&СЕАТ Центр Київ")
    st.subheader("Авторизація співробітника сервісу")
    
    saved_last = st.query_params.get("last_name", "")
    saved_first = st.query_params.get("first_name", "")
    
    last_name = st.text_input("Прізвище *", value=saved_last)
    first_name = st.text_input("Ім'я *", value=saved_first)
    
    if st.button("ВХІД", type="primary"):
        if last_name and first_name:
            st.session_state.authenticated = True
            st.session_state.user_full_name = f"{last_name} {first_name}"
            st.query_params["last_name"] = last_name
            st.query_params["first_name"] = first_name
            st.rerun()
        else:
            st.error("Поля Прізвище та Ім'я є обов'язковими!")
    st.stop()

# ==================== ГОЛОВНИЙ ІНТЕРФЕЙС СЕРВІСУ ====================
st.title("КУПРА&СЕАТ Центр Київ")
st.caption(f"Користувач: {st.session_state.user_full_name} | Поточний час: {datetime.datetime.now().strftime('%H:%M')}")

now = datetime.datetime.now()

# Автоматичне видалення завершених машин за 15 хвилин
for car in global_db[:]:
    if car.get('status') == "Завершено" and car.get('end_time'):
        try:
            if (now - datetime.datetime.fromisoformat(str(car['end_time']))).total_seconds() >= 900:
                global_db.remove(car)
                continue
        except: pass
    if car.get('wh_status') == "Зібрано" and car.get('wh_end_time'):
        try:
            if (now - datetime.datetime.fromisoformat(str(car['wh_end_time']))).total_seconds() >= 900:
                car['wh_status'] = "Видалено з екрану"
        except: pass

tab_record, tab_warehouse, tab_monitor = st.tabs(["Запис 💻", "Склад 📦", "Інфо Монітор 🖥️"])

# --- ВКЛАДКА 1: ЗАПИС ---
with tab_record:
    st.header("Прийом та розподіл автомобілів")
    col_form, col_table = st.columns(2)
    
    with col_form:
        st.subheader("Нова заявка")
        num_in = st.text_input("Номер машини *", key="num_in").upper()
        req_in = st.text_input("Заявка (Номер заказ-наряду) *", key="req_in")
        model_in = st.text_input("Модель авто", key="model_in")
        post_in = st.selectbox("Призначити пост / підйомник", list(post_mechanics.keys()) + ["Не призначено"])
        time_slot = st.selectbox("Час візиту (Для запису)", [f"{h:02d}:{m:02d}" for h in range(9, 18) for m in (0, 30)])
        
        c_btn1, col_btn2 = st.columns(2)
        if c_btn1.button("ВЗЯТИ В РОБОТУ", type="primary"):
            if num_in and req_in:
                global_db.append({
                    "id": int(time.time()), "car_number": num_in, "model": model_in or "-", "request": req_in,
                    "area": "Сервіс", "post": post_in, "start_time": datetime.datetime.now().isoformat(),
                    "end_time": "", "wh_status": "Новий", "wh_end_time": "", "status": "В ремонті"
                })
                st.toast("🚗 Автомобіль успішно взято в роботу!")
                st.rerun()
                
        if col_btn2.button("ЗАПИСАТИ НА СЬОГОДНІ"):
            if num_in and req_in:
                p_hour, p_min = map(int, time_slot.split(":"))
                p_time = datetime.datetime.now().replace(hour=p_hour, minute=p_min, second=0, microsecond=0).isoformat()
                global_db.append({
                    "id": int(time.time()), "car_number": num_in, "model": model_in or "-", "request": req_in,
                    "area": "Сервіс", "post": "Не призначено", "start_time": p_time,
                    "end_time": "", "wh_status": "Новий", "wh_end_time": "", "status": "Запис"
                })
                st.toast("📅 Клієнта успішно записано!")
                st.rerun()

    with col_table:
        st.subheader("Журнал черги")
        for idx, car in enumerate(global_db):
            if car['status'] != "Видалено з екрану":
                with st.expander(f"{car['car_number']} — {car['model']} [{car['status']}]"):
                    st.write(f"Заказ-наряд: {car['request']}")
                    st.write(f"Пост: {car['post']}")
                    new_post = st.selectbox("Змінити пост", list(post_mechanics.keys()) + ["Не призначено"], key=f"edit_p_{car['id']}")
                    if new_post != car['post']:
                        car['post'] = new_post
                        st.rerun()
                    if car['status'] == "Запис":
                        if st.button("Запустити в роботу", key=f"start_b_{car['id']}"):
                            car['status'] = "В ремонті"
                            car['start_time'] = datetime.datetime.now().isoformat()
                            st.rerun()

# --- ВКЛАДКА 2: СКЛАД ---
with tab_warehouse:
    st.header("📦 Складська логіка підготовки деталей")
    warehouse_active = [c for c in global_db if c.get('status') == "В ремонті" and c.get('wh_status') != "Видалено з екрану"]
    
    if not warehouse_active:
        st.info("Наразі немає активних ремонтів, що потребують деталей.")
    else:
        for car in warehouse_active:
            c1, c2, c3, c4 = st.columns(4)
            c1.markdown(f"### {car.get('car_number')}")
            c2.write(f"**{car.get('model')}**\n📄 {car.get('request')}")
            c3.write(f"📍 Пост: {car.get('post')}")
            
            if car.get('wh_status') == "Новий":
                if c4.button("ВЗЯТИ В РОБОТУ 🟢", key=f"wh_btn_{car['id']}", use_container_width=True):
                    car['wh_status'] = "Збирається"
                    st.rerun()
            elif car.get('wh_status') == "Збирається":
                if c4.button("ЗБИРАЄТЬСЯ 🔵", key=f"wh_btn_{car['id']}", use_container_width=True):
                    car['wh_status'] = "Зібрано"
                    car['wh_end_time'] = datetime.datetime.now().isoformat()
                    st.rerun()
            elif car.get('wh_status') == "Зібрано":
                try:
                    end_dt = datetime.datetime.fromisoformat(car['wh_end_time'])
                    rem_min = max(0, int((900 - (now - end_dt).total_seconds()) // 60))
                except: rem_min = 15
                c4.button(f"ЗІБРАНО ✓ ({rem_min} хв.) ⚪", key=f"wh_btn_{car['id']}", disabled=True, use_container_width=True)

# --- ВКЛАДКА 3: ІНФО МОНІТОР ---
with tab_monitor:
    st.header("🖥️ СЕРВІСНА ЗОНА (Табло клієнта)")
    
    for car in global_db:
        try: start_dt = datetime.datetime.fromisoformat(str(car['start_time']))
        except: start_dt = datetime.datetime.now()
        
        if car.get('status') == "В ремонті":
            diff = now - start_dt
            if diff.total_seconds() >= 86400:
                days = diff.days; hours, remainder = divmod(diff.seconds, 3600); minutes, _ = divmod(remainder, 60)
                time_str = f"{days} дн. {hours} год. {minutes} хв."
                border_c, bg_c, text_c = "#fed7aa", "#fff7ed", "#ea580c"
            else:
                hours, remainder = divmod(int(diff.total_seconds()), 3600); minutes, _ = divmod(remainder, 60)
                time_str = f"{hours:02d}:{minutes:02d}"
                border_c, bg_c, text_c = "#e2e8f0", "white", "#38a169"
            st_text = "В роботі:"
            
        elif car.get('status') == "Завершено":
            time_str = "Готово до видачі"
            border_c, bg_c, text_c = "#a7f3d0", "#f0fdf4", "#10b981"
            st_text = "Ремонт:"
            
        else: # Запис
            if now > start_dt:
                time_str = "Потребує узгодження візиту"
                border_c, bg_c, text_c = "#fca5a5", "#fef2f2", "#dc2626"
            else:
                diff = start_dt - now; hours, remainder = divmod(int(diff.total_seconds()), 3600); minutes, _ = divmod(remainder, 60)
                time_str = f"На {start_dt.strftime('%H:%M')} (через {hours}г. {minutes}х.)"
                border_c, bg_c, text_c = "#bfdbfe", "white", "#2563eb"
            st_text = "Запис:"

        if car.get('status') != "В ремонті":
            wh_html = "<span style='color: #94a3b8;'>📦 Статус запчастин: Очікує заїзду авто</span>"
        else:
