ExpensifyPro (SPET) 
Guide to run ExpensifyPro:

First Time Run: 

cd to the Backend
python -m venv .venv
.\.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt

python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser (only one time)
python manage.py runserver
# -> http://127.0.0.1:8000/admin/
# API docs: http://127.0.0.1:8000/api/docs

now open up a new terminal:
cd to vite project
npm install
npm run dev

=> Now you can run it without any errors.
Notes:
-Make sure to delete any existing venv and create a new one in your directory before creating your own.
-Make sure to have a compatible python version (3.11 - 3.12) - (Older versions work too).
-IF the backend is not running the project wont run (obviously).
-DO NOT Create a new venv every time you want to open the project.



Project Created By: Adham Hijazi - Karim Chames El Deen - Mohammad Itani - Mohammad Al Yousif.
