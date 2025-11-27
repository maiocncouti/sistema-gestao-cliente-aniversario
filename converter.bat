@echo off
chcp 65001 >nul
echo ========================================
echo 🎬 Conversor de Vídeo MP4 para WebM
echo ========================================
echo.

REM Verificar se ffmpeg está instalado
where ffmpeg >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ffmpeg não está instalado!
    echo.
    echo 📥 Para instalar:
    echo    1. winget install ffmpeg
    echo    2. Ou baixe de https://ffmpeg.org/download.html
    echo.
    echo 🌐 Ou use conversão online:
    echo    https://cloudconvert.com/mp4-to-webm
    echo.
    pause
    exit /b 1
)

echo ✅ ffmpeg encontrado!
echo.
echo 🔄 Convertendo videos\entrada 2-1.mp4 para videos\entrada 2-1.webm...
echo    Isso pode levar alguns minutos...
echo.

ffmpeg -i "videos\entrada 2-1.mp4" -c:v libvpx-vp9 -c:a libopus -crf 30 -b:v 0 -y "videos\entrada 2-1.webm"

if %errorlevel% equ 0 (
    echo.
    echo ✅ Conversão concluída com sucesso!
    echo 📁 Arquivo salvo em: videos\entrada 2-1.webm
    echo.
    echo 📝 Próximos passos:
    echo    1. git add videos\entrada\ 2-1.webm
    echo    2. git add index.html
    echo    3. git commit -m "Adiciona suporte WebM para vídeo"
    echo    4. git push
) else (
    echo.
    echo ❌ Erro na conversão!
    echo Verifique se o arquivo videos\entrada 2-1.mp4 existe.
)

echo.
pause

