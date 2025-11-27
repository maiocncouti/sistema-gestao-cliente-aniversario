# 🎬 Instruções para Converter Vídeo MP4 para WebM

## Opção 1: Usando FFmpeg (Recomendado)

### Instalar FFmpeg no Windows:

1. **Usando winget (Windows 10/11):**
   ```powershell
   winget install ffmpeg
   ```

2. **Ou baixar manualmente:**
   - Acesse: https://ffmpeg.org/download.html
   - Baixe a versão para Windows
   - Extraia e adicione ao PATH do sistema

3. **Ou usando Chocolatey:**
   ```powershell
   choco install ffmpeg
   ```

### Converter o vídeo:

Após instalar o ffmpeg, execute no PowerShell na pasta do projeto:

```powershell
ffmpeg -i "videos/entrada 2-1.mp4" -c:v libvpx-vp9 -c:a libopus -crf 30 -b:v 0 "videos/entrada 2-1.webm"
```

## Opção 2: Conversão Online (Mais Fácil)

1. Acesse: https://cloudconvert.com/mp4-to-webm
2. Faça upload do arquivo `videos/entrada 2-1.mp4`
3. Configure:
   - **Codec de vídeo:** VP9
   - **Qualidade:** Alta
4. Baixe o arquivo convertido
5. Renomeie para `entrada 2-1.webm`
6. Coloque na pasta `videos/`

## Opção 3: Usar o Script Python

Se o ffmpeg estiver instalado, execute:

```powershell
python convert_video.py
```

## ✅ Após a Conversão

1. Verifique se o arquivo `videos/entrada 2-1.webm` foi criado
2. O HTML já está configurado para usar ambos os formatos
3. Faça commit e push para o GitHub:

```powershell
git add videos/entrada\ 2-1.webm
git add index.html
git commit -m "Adiciona suporte WebM para vídeo de splash screen"
git push
```

