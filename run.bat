@echo off
echo.
echo ========================================
echo    BLINDGO - Voice Assistant
echo ========================================
echo.
echo Starting BLINDGO application...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher
    pause
    exit /b 1
)

REM Check if requirements are installed
echo Checking dependencies...
pip show flask >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Start the application
echo.
echo Starting Flask application...
echo.
echo BLINDGO will open in your browser at: http://localhost:5000
echo.
echo Press Ctrl+C to stop the application
echo.

python run.py

pause
