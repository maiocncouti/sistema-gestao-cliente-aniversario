# Sistema de Gerenciamento de Licenças Temporárias

Sistema completo de gerenciamento de licenças temporárias (Trial) em Python com **portabilidade total** e **segurança offline**.

## Características Principais

✅ **Portabilidade Total**: Armazenamento exclusivo em arquivo `.license_key` no diretório raiz  
✅ **Segurança Offline**: Funciona completamente offline, sem dependência de servidores  
✅ **Anti-Fraude**: Detecção de rollback de data/hora do sistema  
✅ **Base64 Encoding**: Ofuscação dos dados da licença  
✅ **Múltiplos Tipos**: Suporte a diferentes durações de licença  

## Estrutura do Sistema

### Arquivo de Licença (`.license_key`)

O arquivo `.license_key` é criado automaticamente no diretório raiz do projeto e contém:

- **key**: A chave de licença ativada
- **EXPIRATION_TIME**: Timestamp de expiração (ISO format)
- **LAST_USED_TIME**: Timestamp da última verificação bem-sucedida
- **ACTIVATED_TIME**: Timestamp de quando a licença foi ativada

Todos os dados são codificados em **Base64** para ofuscação.

## Tipos de Chaves Suportadas

| Prefixo da Chave | Duração | Exemplo |
|-----------------|---------|---------|
| `TESTE-5MIN` | 5 minutos | `TESTE-5MIN-ABC123` |
| `TRIAL-3DIAS` | 3 dias | `TRIAL-3DIAS-XYZ789` |
| `MENSAL-30D` | 30 dias | `MENSAL-30D-MONTHLY001` |
| `ANUAL-365D` | 365 dias | `ANUAL-365D-YEARLY2024` |

## Funções Principais

### `activate_license(key_string)`

Ativa uma licença com a chave fornecida.

```python
from license_manager import activate_license

resultado = activate_license("TESTE-5MIN-ABC123")
if resultado['success']:
    print(resultado['message'])
    print(f"Expira em: {resultado['expiration']}")
```

**Retorna:**
```python
{
    'success': bool,
    'message': str,
    'expiration': datetime ou None
}
```

### `check_license()`

Verifica o status da licença atual. Executa todas as validações de segurança.

```python
from license_manager import check_license

status = check_license()
if status['valid']:
    print("Licença válida!")
else:
    print(f"Erro: {status['message']}")
```

**Retorna:**
```python
{
    'valid': bool,
    'message': str,
    'expired': bool,
    'violated': bool,
    'expiration_time': datetime ou None,
    'last_used_time': datetime ou None,
    'action_required': str ou None
}
```

**Validações Realizadas:**
1. ✅ Verifica se a licença existe
2. ✅ Verifica se a licença expirou
3. ✅ **Anti-Fraude**: Detecta rollback de data/hora (tempo atual < LAST_USED_TIME)
4. ✅ Atualiza `LAST_USED_TIME` se a licença for válida

### `get_remaining_time()`

Retorna o tempo restante da licença.

```python
from license_manager import get_remaining_time

tempo = get_remaining_time()
if tempo['remaining']:
    print(tempo['message'])
    print(f"Segundos: {tempo['remaining_seconds']}")
    print(f"Dias: {tempo['remaining_days']:.2f}")
```

**Retorna:**
```python
{
    'remaining': timedelta ou None,
    'remaining_seconds': int ou None,
    'remaining_days': float ou None,
    'remaining_hours': float ou None,
    'expiration_time': datetime ou None,
    'message': str
}
```

### `deactivate_license()`

Desativa e remove a licença atual.

```python
from license_manager import deactivate_license

resultado = deactivate_license()
print(resultado['message'])
```

## Exemplo de Uso Completo

```python
from license_manager import activate_license, check_license, get_remaining_time

# 1. Ativar licença
resultado = activate_license("TRIAL-3DIAS-MINHA-CHAVE")
if not resultado['success']:
    print(f"Erro: {resultado['message']}")
    exit(1)

# 2. Verificar licença (deve ser chamado periodicamente)
status = check_license()
if not status['valid']:
    print(f"Licença inválida: {status['message']}")
    exit(1)

# 3. Consultar tempo restante
tempo = get_remaining_time()
print(tempo['message'])

# 4. Continuar usando o software...
```

## Segurança Anti-Fraude

O sistema implementa proteção contra manipulação do relógio do sistema:

- **Detecção de Rollback**: Se o tempo atual for anterior ao `LAST_USED_TIME`, a licença é marcada como **permanentemente violada**
- **Violação Permanente**: Uma vez violada, a licença não pode ser reativada
- **Atualização Contínua**: Cada verificação bem-sucedida atualiza o `LAST_USED_TIME`

## Executando os Exemplos

### Exemplo Básico
```bash
python license_manager.py
```

### Exemplos Completos
```bash
python exemplo_uso.py
```

## Integração no Seu Software

Para integrar o sistema de licenças no seu software:

```python
from license_manager import check_license

def verificar_licenca_antes_de_usar():
    """Chame esta função antes de permitir o uso do software"""
    status = check_license()
    
    if not status['valid']:
        if status.get('action_required') == 'activate':
            print("Por favor, ative uma licença primeiro.")
        elif status.get('violated'):
            print("Licença violada. Entre em contato com o suporte.")
        elif status.get('expired'):
            print("Licença expirada. Renove sua licença.")
        return False
    
    return True

# No início do seu software:
if not verificar_licenca_antes_de_usar():
    exit(1)

# Continue com o software...
```

## Notas Importantes

⚠️ **Portabilidade**: O arquivo `.license_key` deve estar no mesmo diretório do `license_manager.py`  
⚠️ **Segurança**: O Base64 é apenas ofuscação, não criptografia forte  
⚠️ **Backup**: Faça backup do arquivo `.license_key` se necessário  
⚠️ **Git**: O arquivo `.license_key` está no `.gitignore` e não será commitado  

## Estrutura de Arquivos

```
projeto/
├── license_manager.py      # Sistema principal de licenças
├── exemplo_uso.py          # Exemplos de uso
├── .license_key            # Arquivo de licença (gerado automaticamente)
├── .gitignore              # Ignora .license_key
└── README_LICENCA.md       # Esta documentação
```

## Suporte

Para problemas ou dúvidas sobre o sistema de licenças, consulte o código-fonte ou os exemplos fornecidos.

