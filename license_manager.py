"""
Sistema de Gerenciamento de Licenças Temporárias (Trial)
Com portabilidade total e segurança offline
"""

import os
import json
import base64
from datetime import datetime, timedelta
from pathlib import Path


# Nome do arquivo de licença (no diretório raiz do projeto)
LICENSE_FILE = ".license_key"


def get_key_duration(key_string: str) -> timedelta:
    """
    Retorna a duração da licença baseada no prefixo da chave.
    
    Args:
        key_string: A chave de licença
        
    Returns:
        timedelta: A duração da licença
    """
    key_upper = key_string.upper()
    
    if key_upper.startswith("TESTE-5MIN"):
        return timedelta(minutes=5)
    elif key_upper.startswith("TRIAL-3DIAS"):
        return timedelta(days=3)
    elif key_upper.startswith("MENSAL-30D"):
        return timedelta(days=30)
    elif key_upper.startswith("ANUAL-365D"):
        return timedelta(days=365)
    else:
        raise ValueError(f"Chave de licença inválida ou não reconhecida: {key_string}")


def get_project_root() -> Path:
    """
    Retorna o diretório raiz do projeto (onde está este arquivo).
    
    Returns:
        Path: Caminho do diretório raiz
    """
    return Path(__file__).parent


def get_license_file_path() -> Path:
    """
    Retorna o caminho completo do arquivo de licença.
    
    Returns:
        Path: Caminho do arquivo .license_key
    """
    return get_project_root() / LICENSE_FILE


def encode_license_data(data: dict) -> str:
    """
    Codifica os dados da licença em Base64.
    
    Args:
        data: Dicionário com os dados da licença
        
    Returns:
        str: String codificada em Base64
    """
    json_str = json.dumps(data, ensure_ascii=False)
    encoded = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
    return encoded


def decode_license_data(encoded_data: str) -> dict:
    """
    Decodifica os dados da licença de Base64.
    
    Args:
        encoded_data: String codificada em Base64
        
    Returns:
        dict: Dicionário com os dados da licença
    """
    try:
        decoded = base64.b64decode(encoded_data.encode('utf-8')).decode('utf-8')
        return json.loads(decoded)
    except (base64.binascii.Error, json.JSONDecodeError) as e:
        raise ValueError(f"Erro ao decodificar dados da licença: {e}")


def load_license() -> dict:
    """
    Carrega os dados da licença do arquivo .license_key.
    
    Returns:
        dict: Dicionário com os dados da licença ou None se não existir
    """
    license_path = get_license_file_path()
    
    if not license_path.exists():
        return None
    
    try:
        with open(license_path, 'r', encoding='utf-8') as f:
            encoded_data = f.read().strip()
        
        if not encoded_data:
            return None
        
        return decode_license_data(encoded_data)
    except Exception as e:
        raise IOError(f"Erro ao ler arquivo de licença: {e}")


def save_license(license_data: dict) -> None:
    """
    Salva os dados da licença no arquivo .license_key (codificado em Base64).
    
    Args:
        license_data: Dicionário com os dados da licença
    """
    license_path = get_license_file_path()
    
    try:
        encoded_data = encode_license_data(license_data)
        
        with open(license_path, 'w', encoding='utf-8') as f:
            f.write(encoded_data)
    except Exception as e:
        raise IOError(f"Erro ao salvar arquivo de licença: {e}")


def activate_license(key_string: str) -> dict:
    """
    Ativa uma licença com a chave fornecida.
    
    Args:
        key_string: A chave de licença a ser ativada
        
    Returns:
        dict: Status da ativação {'success': bool, 'message': str, 'expiration': datetime}
    """
    try:
        # Verifica se já existe uma licença ativa
        existing_license = load_license()
        if existing_license:
            return {
                'success': False,
                'message': 'Já existe uma licença ativada. Desative a licença atual antes de ativar uma nova.',
                'expiration': None
            }
        
        # Obtém a duração baseada na chave
        duration = get_key_duration(key_string)
        
        # Calcula o tempo de expiração
        current_time = datetime.now()
        expiration_time = current_time + duration
        
        # Cria o objeto de licença
        license_data = {
            'key': key_string,
            'EXPIRATION_TIME': expiration_time.isoformat(),
            'LAST_USED_TIME': current_time.isoformat(),
            'ACTIVATED_TIME': current_time.isoformat()
        }
        
        # Salva a licença
        save_license(license_data)
        
        return {
            'success': True,
            'message': f'Licença ativada com sucesso! Expira em: {expiration_time.strftime("%d/%m/%Y %H:%M:%S")}',
            'expiration': expiration_time
        }
        
    except ValueError as e:
        return {
            'success': False,
            'message': str(e),
            'expiration': None
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'Erro ao ativar licença: {e}',
            'expiration': None
        }


def check_license() -> dict:
    """
    Verifica o status da licença atual.
    Executa todas as validações de segurança e anti-fraude.
    
    Returns:
        dict: Status da licença {
            'valid': bool,
            'message': str,
            'expired': bool,
            'violated': bool,
            'expiration_time': datetime,
            'last_used_time': datetime
        }
    """
    license_path = get_license_file_path()
    current_time = datetime.now()
    
    # 1. Checagem de Ativação
    if not license_path.exists():
        return {
            'valid': False,
            'message': 'Licença não encontrada. É necessário ativar uma licença primeiro.',
            'expired': False,
            'violated': False,
            'expiration_time': None,
            'last_used_time': None,
            'action_required': 'activate'
        }
    
    # Carrega os dados da licença
    try:
        license_data = load_license()
        if not license_data:
            return {
                'valid': False,
                'message': 'Arquivo de licença corrompido ou vazio.',
                'expired': False,
                'violated': False,
                'expiration_time': None,
                'last_used_time': None,
                'action_required': 'activate'
            }
    except Exception as e:
        return {
            'valid': False,
            'message': f'Erro ao carregar licença: {e}',
            'expired': False,
            'violated': False,
            'expiration_time': None,
            'last_used_time': None,
            'action_required': 'activate'
        }
    
    # Converte timestamps para datetime
    try:
        expiration_time = datetime.fromisoformat(license_data['EXPIRATION_TIME'])
        last_used_time = datetime.fromisoformat(license_data['LAST_USED_TIME'])
    except (KeyError, ValueError) as e:
        return {
            'valid': False,
            'message': f'Dados de licença inválidos: {e}',
            'expired': False,
            'violated': False,
            'expiration_time': None,
            'last_used_time': None,
            'action_required': 'activate'
        }
    
    # 3. Checagem Anti-Fraude (Rollback) - MAIS IMPORTANTE
    # Se o tempo atual é anterior ao LAST_USED_TIME, significa que o relógio foi alterado para trás
    if current_time < last_used_time:
        # Marca a licença como violada permanentemente
        license_data['VIOLATED'] = True
        license_data['VIOLATION_TIME'] = current_time.isoformat()
        license_data['VIOLATION_REASON'] = 'Rollback de data/hora detectado'
        save_license(license_data)
        
        return {
            'valid': False,
            'message': 'LICENÇA VIOLADA: Detectada tentativa de manipulação do relógio do sistema. A licença foi permanentemente invalidada.',
            'expired': False,
            'violated': True,
            'expiration_time': expiration_time,
            'last_used_time': last_used_time,
            'action_required': 'violated'
        }
    
    # Verifica se a licença já foi violada anteriormente
    if license_data.get('VIOLATED', False):
        return {
            'valid': False,
            'message': 'Licença violada anteriormente e permanentemente invalidada.',
            'expired': False,
            'violated': True,
            'expiration_time': expiration_time,
            'last_used_time': last_used_time,
            'action_required': 'violated'
        }
    
    # 2. Checagem de Expiração
    if current_time >= expiration_time:
        return {
            'valid': False,
            'message': f'Licença expirada em {expiration_time.strftime("%d/%m/%Y %H:%M:%S")}.',
            'expired': True,
            'violated': False,
            'expiration_time': expiration_time,
            'last_used_time': last_used_time,
            'action_required': 'expired'
        }
    
    # 4. Atualização: Licença válida - atualiza LAST_USED_TIME
    license_data['LAST_USED_TIME'] = current_time.isoformat()
    save_license(license_data)
    
    return {
        'valid': True,
        'message': 'Licença válida e ativa.',
        'expired': False,
        'violated': False,
        'expiration_time': expiration_time,
        'last_used_time': current_time,
        'action_required': None
    }


def get_remaining_time() -> dict:
    """
    Retorna o tempo restante da licença atual.
    
    Returns:
        dict: {
            'remaining': timedelta ou None,
            'remaining_seconds': int ou None,
            'remaining_days': float ou None,
            'expiration_time': datetime ou None,
            'message': str
        }
    """
    license_status = check_license()
    
    if not license_status['valid']:
        return {
            'remaining': None,
            'remaining_seconds': None,
            'remaining_days': None,
            'remaining_hours': None,
            'expiration_time': license_status.get('expiration_time'),
            'message': license_status['message']
        }
    
    expiration_time = license_status['expiration_time']
    current_time = datetime.now()
    remaining = expiration_time - current_time
    
    if remaining.total_seconds() <= 0:
        return {
            'remaining': timedelta(0),
            'remaining_seconds': 0,
            'remaining_days': 0.0,
            'remaining_hours': 0.0,
            'expiration_time': expiration_time,
            'message': 'Licença expirada'
        }
    
    return {
        'remaining': remaining,
        'remaining_seconds': int(remaining.total_seconds()),
        'remaining_days': remaining.total_seconds() / 86400,
        'remaining_hours': remaining.total_seconds() / 3600,
        'expiration_time': expiration_time,
        'message': f'Tempo restante: {remaining.days} dias, {remaining.seconds // 3600} horas, {(remaining.seconds % 3600) // 60} minutos'
    }


def deactivate_license() -> dict:
    """
    Desativa e remove a licença atual.
    
    Returns:
        dict: Status da desativação
    """
    license_path = get_license_file_path()
    
    if not license_path.exists():
        return {
            'success': False,
            'message': 'Nenhuma licença encontrada para desativar.'
        }
    
    try:
        license_path.unlink()
        return {
            'success': True,
            'message': 'Licença desativada com sucesso.'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'Erro ao desativar licença: {e}'
        }


if __name__ == "__main__":
    print("=" * 60)
    print("SISTEMA DE GERENCIAMENTO DE LICENÇAS TEMPORÁRIAS")
    print("=" * 60)
    print()
    
    # Demonstração: Ativação de uma chave de teste
    print("1. ATIVANDO LICENÇA DE TESTE (5 minutos)...")
    print("-" * 60)
    test_key = "TESTE-5MIN-ABC123XYZ"
    activation_result = activate_license(test_key)
    print(f"Resultado: {activation_result['message']}")
    if activation_result['success']:
        print(f"Expiração: {activation_result['expiration']}")
    print()
    
    # Verificação da licença
    print("2. VERIFICANDO LICENÇA...")
    print("-" * 60)
    check_result = check_license()
    print(f"Status: {'VÁLIDA' if check_result['valid'] else 'INVÁLIDA'}")
    print(f"Mensagem: {check_result['message']}")
    if check_result['expiration_time']:
        print(f"Expira em: {check_result['expiration_time'].strftime('%d/%m/%Y %H:%M:%S')}")
    print()
    
    # Tempo restante
    print("3. TEMPO RESTANTE...")
    print("-" * 60)
    remaining = get_remaining_time()
    if remaining['remaining']:
        print(remaining['message'])
        print(f"Segundos restantes: {remaining['remaining_seconds']}")
        print(f"Dias restantes: {remaining['remaining_days']:.2f}")
        print(f"Horas restantes: {remaining['remaining_hours']:.2f}")
    else:
        print(remaining['message'])
    print()
    
    # Exemplo de outras chaves
    print("4. EXEMPLOS DE CHAVES SUPORTADAS:")
    print("-" * 60)
    example_keys = [
        "TESTE-5MIN-ABC123",
        "TRIAL-3DIAS-XYZ789",
        "MENSAL-30D-MONTHLY001",
        "ANUAL-365D-YEARLY2024"
    ]
    
    for key in example_keys:
        try:
            duration = get_key_duration(key)
            print(f"  {key}: {duration}")
        except ValueError as e:
            print(f"  {key}: ERRO - {e}")
    print()
    
    print("=" * 60)
    print("Demonstração concluída!")
    print("=" * 60)

