"""
Exemplo de uso do Sistema de Gerenciamento de Licenças
"""

from license_manager import (
    activate_license,
    check_license,
    get_remaining_time,
    deactivate_license,
    get_key_duration
)


def exemplo_ativacao():
    """Exemplo de ativação de diferentes tipos de licenças"""
    print("\n" + "="*60)
    print("EXEMPLO 1: ATIVAÇÃO DE LICENÇAS")
    print("="*60)
    
    # Exemplo 1: Licença de teste (5 minutos)
    print("\n1. Ativando licença de TESTE (5 minutos)...")
    resultado = activate_license("TESTE-5MIN-DEMO123")
    print(f"   {resultado['message']}")
    
    # Exemplo 2: Tentativa de ativar outra licença (deve falhar)
    print("\n2. Tentando ativar outra licença (deve falhar)...")
    resultado2 = activate_license("TRIAL-3DIAS-NOVA456")
    print(f"   {resultado2['message']}")
    
    # Exemplo 3: Desativar e ativar nova
    print("\n3. Desativando licença atual...")
    deactivate_result = deactivate_license()
    print(f"   {deactivate_result['message']}")
    
    print("\n4. Ativando licença TRIAL (3 dias)...")
    resultado3 = activate_license("TRIAL-3DIAS-DEMO789")
    print(f"   {resultado3['message']}")


def exemplo_verificacao():
    """Exemplo de verificação de licença"""
    print("\n" + "="*60)
    print("EXEMPLO 2: VERIFICAÇÃO DE LICENÇA")
    print("="*60)
    
    status = check_license()
    
    print(f"\nStatus da Licença: {'✓ VÁLIDA' if status['valid'] else '✗ INVÁLIDA'}")
    print(f"Mensagem: {status['message']}")
    
    if status['expiration_time']:
        print(f"Expira em: {status['expiration_time'].strftime('%d/%m/%Y %H:%M:%S')}")
    
    if status['last_used_time']:
        print(f"Última verificação: {status['last_used_time'].strftime('%d/%m/%Y %H:%M:%S')}")
    
    if status.get('violated'):
        print("⚠ ATENÇÃO: Licença violada!")


def exemplo_tempo_restante():
    """Exemplo de consulta de tempo restante"""
    print("\n" + "="*60)
    print("EXEMPLO 3: TEMPO RESTANTE")
    print("="*60)
    
    tempo = get_remaining_time()
    
    print(f"\n{tempo['message']}")
    
    if tempo['remaining']:
        print(f"\nDetalhes:")
        print(f"  - Segundos: {tempo['remaining_seconds']:,}")
        print(f"  - Horas: {tempo['remaining_hours']:.2f}")
        print(f"  - Dias: {tempo['remaining_days']:.2f}")
        
        if tempo['expiration_time']:
            print(f"\nExpira em: {tempo['expiration_time'].strftime('%d/%m/%Y %H:%M:%S')}")


def exemplo_tipos_chaves():
    """Exemplo mostrando todos os tipos de chaves suportados"""
    print("\n" + "="*60)
    print("EXEMPLO 4: TIPOS DE CHAVES SUPORTADAS")
    print("="*60)
    
    chaves_exemplo = [
        "TESTE-5MIN-ABC123",
        "TRIAL-3DIAS-XYZ789",
        "MENSAL-30D-MONTHLY001",
        "ANUAL-365D-YEARLY2024"
    ]
    
    print("\nChaves e suas durações:")
    for chave in chaves_exemplo:
        try:
            duracao = get_key_duration(chave)
            dias = duracao.total_seconds() / 86400
            horas = duracao.total_seconds() / 3600
            minutos = duracao.total_seconds() / 60
            
            print(f"\n  {chave}")
            if dias >= 1:
                print(f"    → {dias:.0f} dias ({horas:.0f} horas)")
            elif horas >= 1:
                print(f"    → {horas:.0f} horas ({minutos:.0f} minutos)")
            else:
                print(f"    → {minutos:.0f} minutos")
        except ValueError as e:
            print(f"\n  {chave}")
            print(f"    → ERRO: {e}")


def exemplo_fluxo_completo():
    """Demonstra um fluxo completo de uso"""
    print("\n" + "="*60)
    print("EXEMPLO 5: FLUXO COMPLETO DE USO")
    print("="*60)
    
    # 1. Verificar se há licença
    print("\n1. Verificando licença atual...")
    status = check_license()
    if not status['valid']:
        print(f"   {status['message']}")
        print("\n2. Ativando nova licença de teste...")
        resultado = activate_license("TESTE-5MIN-FLUXO001")
        print(f"   {resultado['message']}")
    else:
        print(f"   {status['message']}")
    
    # 2. Verificar novamente
    print("\n3. Verificando licença após ativação...")
    status = check_license()
    print(f"   Status: {'VÁLIDA' if status['valid'] else 'INVÁLIDA'}")
    print(f"   {status['message']}")
    
    # 3. Consultar tempo restante
    print("\n4. Consultando tempo restante...")
    tempo = get_remaining_time()
    print(f"   {tempo['message']}")
    
    # 4. Verificar novamente (simula uso contínuo)
    print("\n5. Simulando verificação contínua...")
    for i in range(3):
        status = check_license()
        tempo = get_remaining_time()
        print(f"   Verificação {i+1}: {'Válida' if status['valid'] else 'Inválida'} - {tempo['message']}")


if __name__ == "__main__":
    print("\n" + "="*70)
    print("SISTEMA DE GERENCIAMENTO DE LICENÇAS - EXEMPLOS DE USO")
    print("="*70)
    
    # Executa todos os exemplos
    exemplo_tipos_chaves()
    exemplo_ativacao()
    exemplo_verificacao()
    exemplo_tempo_restante()
    exemplo_fluxo_completo()
    
    print("\n" + "="*70)
    print("Todos os exemplos foram executados!")
    print("="*70 + "\n")

