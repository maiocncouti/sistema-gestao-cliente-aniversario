#!/usr/bin/env python3
"""
Script para converter vídeo MP4 para WebM
Requer ffmpeg instalado no sistema
"""

import subprocess
import os
import sys

def check_ffmpeg():
    """Verifica se ffmpeg está instalado"""
    try:
        subprocess.run(['ffmpeg', '-version'], 
                     capture_output=True, 
                     check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def convert_to_webm(input_file, output_file):
    """Converte vídeo MP4 para WebM usando ffmpeg"""
    if not os.path.exists(input_file):
        print(f"❌ Erro: Arquivo não encontrado: {input_file}")
        return False
    
    print(f"🔄 Convertendo {input_file} para {output_file}...")
    
    # Comando ffmpeg para conversão
    # -c:v libvpx-vp9: codec de vídeo VP9 (melhor qualidade)
    # -c:a libopus: codec de áudio Opus
    # -crf 30: qualidade (0-63, menor = melhor qualidade)
    # -b:v 0: bitrate variável
    cmd = [
        'ffmpeg',
        '-i', input_file,
        '-c:v', 'libvpx-vp9',
        '-c:a', 'libopus',
        '-crf', '30',
        '-b:v', '0',
        '-y',  # Sobrescrever arquivo se existir
        output_file
    ]
    
    try:
        result = subprocess.run(cmd, 
                              capture_output=True, 
                              text=True,
                              check=True)
        print(f"✅ Conversão concluída com sucesso!")
        print(f"📁 Arquivo salvo em: {output_file}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Erro na conversão:")
        print(f"   {e.stderr}")
        return False
    except FileNotFoundError:
        print("❌ ffmpeg não encontrado!")
        return False

def main():
    input_file = "videos/entrada 2-1.mp4"
    output_file = "videos/entrada 2-1.webm"
    
    print("=" * 50)
    print("🎬 Conversor de Vídeo MP4 para WebM")
    print("=" * 50)
    print()
    
    # Verificar se ffmpeg está instalado
    if not check_ffmpeg():
        print("❌ ffmpeg não está instalado no sistema.")
        print()
        print("📥 Para instalar o ffmpeg:")
        print("   1. Windows: Baixe de https://ffmpeg.org/download.html")
        print("   2. Ou use: winget install ffmpeg")
        print("   3. Ou use: choco install ffmpeg (se tiver Chocolatey)")
        print()
        print("🌐 Alternativa online:")
        print("   Use https://cloudconvert.com/mp4-to-webm")
        print("   ou https://convertio.co/mp4-webm/")
        print()
        return False
    
    # Converter vídeo
    success = convert_to_webm(input_file, output_file)
    
    if success:
        # Verificar tamanho dos arquivos
        if os.path.exists(input_file) and os.path.exists(output_file):
            mp4_size = os.path.getsize(input_file) / (1024 * 1024)  # MB
            webm_size = os.path.getsize(output_file) / (1024 * 1024)  # MB
            print()
            print("📊 Tamanho dos arquivos:")
            print(f"   MP4:  {mp4_size:.2f} MB")
            print(f"   WebM: {webm_size:.2f} MB")
            print(f"   Redução: {((1 - webm_size/mp4_size) * 100):.1f}%")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

