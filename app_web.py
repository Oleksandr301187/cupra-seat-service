import streamlit as st
import datetime
import time

# НАСТРОЙКА СТРАНИЦЫ БРАУЗЕРА
st.set_page_config(page_title="КУПРА&СЕАТ Центр Київ", layout="wide")

# Инициализация общей базы данных в памяти веб-сервера
if "db" not in st.session_state:
    st.session_state.db = [
        {"id": 1, "car_number": "AA 1234 BB", "model": "Cupra Formentor", "request": "ЗН-00124", "area": "Сервіс", "post": "Підйомник 1", "start_time": (datetime.datetime.now() - datetime.timedelta(hours=2)).strftime("%H:%M"), "end_time": None, "wh_status": "Новий", "status": "В ремонті"},
        {"id": 2, "car_number": "BC 7788 CA", "model": "SEAT Leon", "request": "ЗН-00125", "area": "Сервіс", "post": "Не призначено", "start_time": "19:30", "end_time": None, "wh_status": "Новий", "status": "Запис"}
    ]

# ==================== ЭКРАН АВТОРИЗАЦИИ В БРАУЗЕРЕ ====================
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False

if not st.session_state.authenticated:
    st.title("КУПРА&СЕАТ Центр Київ")
    st.subheader("Авторизація співробітника сервісу")
    
    # Исправленное чтение параметров ссылки под новые стандарты Streamlit
    saved_last = st.query_params.get("last_name", "")
    saved_first = st.query_params.get("first_name", "")
    
    # Раздельные поля ввода
    last_name = st.text_input("Прізвище *", value=saved_last)
    first_name = st.text_input("Ім'я *", value=saved_first)
    
    if st.button("ВХІД", type="primary"):
        if last_name and first_name:
            st.session_state.authenticated = True
            st.session_state.user_full_name = f"{last_name} {first_name}"
            # Браузер надежно запомнит пользователя прямо в адресной строке
            st.query_params["last_name"] = last_name
            st.query_params["first_name"] = first_name
            st.rerun()
        else:
            st.error("Поля Прізвище та Ім'я є обов'язковими!")
    st.stop()

# ==================== ОСНОВНОЙ ИНТЕРФЕЙС СИСТЕМЫ ====================
st.title("КУПРА&СЕАТ Центр Київ")
st.caption(f"Користувач: {st.session_state.user_full_name} | Время обновления: {datetime.datetime.now().strftime('%H:%M:%S')}")

tab_record, tab_warehouse, tab_monitor = st.tabs(["Запис", "Склад 📦", "Інфо Монітор 🖥️"])

# --- ВКЛАДКА 1: ЗАПИС ---
with tab_record:
    st.header("Прийом авто (На сьогодні)")
    col_form, col_table = st.columns()
    
    with col_form:
        num = st.text_input("Номер машини *")
        req = st.text_input("Заявка (Номер заказ-наряду) *")
        model = st.text_input("Модель авто (опціонально)")
        time_slot = st.selectbox("Час візиту", [f"{h:02d}:{m:02d}" for h in range(9, 18) for m in (0, 30)])
        
        col_btn1, col_btn2 = st.columns(2)
        if col_btn1.button("ВЗЯТИ В РОБОТУ"):
            if num and req:
                st.session_state.db.append({
                    "id": len(st.session_state.db) + 1, "car_number": num.upper(), "model": model or "-", "request": req,
                    "area": "Сервіс", "post": "Не призначено", "start_time": datetime.datetime.now().strftime("%H:%M"),
                    "end_time": None, "wh_status": "Новий", "status": "В ремонті"
                })
                st.rerun()
        if col_btn2.button("ЗАПИСАТИ"):
            if num and req:
                st.session_state.db.append({
                    "id": len(st.session_state.db) + 1, "car_number": num.upper(), "model": model or "-", "request": req,
                    "area": "Сервіс", "post": "Не призначено", "start_time": time_slot,
                    "end_time": None, "wh_status": "Новий", "status": "Запис"
                })
                st.rerun()

    with col_table:
        st.subheader("Журнал записів")
        st.write(st.session_state.db)

# --- ВКЛАДКА 2: СКЛАД ---
with tab_warehouse:
    st.header("📦 Склад: Конвеєр підготовки деталей")
    active_repairs = [c for c in st.session_state.db if c["status"] == "В ремонті" and c["wh_status"] != "Видалено"]
    
    for car in active_repairs:
        col_c1, col_c2, col_c3, col_c4 = st.columns()
        col_c1.markdown(f"**{car['car_number']}**")
        col_c2.write(f"{car['model']}")
        col_c3.write(f"📄 {car['request']}")
        
        btn_label = "ВЗЯТИ В РОБОТУ" if car["wh_status"] == "Новий" else "ЗБИРАЄТЬСЯ" if car["wh_status"] == "Збирається" else "ЗІБРАНО ✓"
        if col_c4.button(btn_label, key=f"wh_{car['id']}"):
            if car["wh_status"] == "Новий": car["wh_status"] = "Збирається"
            elif car['wh_status'] == "Збирається": car['wh_status'] = "Зібрано"
            st.rerun()

# --- ВКЛАДКА 3: ИНФО МОНИТОР ---
with tab_monitor:
    st.header("🖥️ СЕРВІСНА ЗОНА (Широкі картки списком)")
    
    for car in st.session_state.db:
        with st.container():
            st.markdown(f"""
            <div style="background-color: white; border: 1px solid #cbd5e1; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                <h3 style="margin:0; color:#111827;">{car['car_number']}</h3>
                <p style="margin:5px 0; color:#4a5568;"><b>{car['model']}</b> ({car['request']})</p>
                <p style="margin:0; color:#64748b; font-size:14px;">📍 Пост: {car['post']} | 🔧 Статус деталей: {car['wh_status']}</p>
            </div>
            """, unsafe_allow_html=True)

# Автоматический перезапуск страницы раз в 3 секунды для имитации таймера обновления
time.sleep(3)
st.rerun()
