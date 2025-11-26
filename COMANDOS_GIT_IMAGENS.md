# Comandos Git para Enviar Pasta Images ao GitHub Pages

## ⚠️ IMPORTANTE: Case Sensitivity
O GitHub Pages (servidor Linux) é **case-sensitive**. Certifique-se de que:
- Os nomes dos arquivos estão exatamente como no código: `support-photo.jpg` e `marcio.jpg`
- Os caminhos no HTML estão corretos: `images/support-photo.jpg` e `images/marcio.jpg`

## 📋 Comandos para Executar no Terminal

### 1. Navegar até a pasta do projeto
```bash
cd "C:\Users\couti\OneDrive\Área de Trabalho\PROJETO"
```

### 2. Verificar status do Git
```bash
git status
```

### 3. Forçar adição da pasta images (mesmo se estiver no .gitignore)
```bash
git add -f images/
```

### 4. Verificar se os arquivos foram adicionados
```bash
git status
```
Você deve ver `images/support-photo.jpg` e `images/marcio.jpg` na lista de arquivos para commit.

### 5. Fazer commit das imagens
```bash
git commit -m "Adicionar imagens de suporte (support-photo.jpg e marcio.jpg)"
```

### 6. Enviar para o GitHub
```bash
git push origin main
```
**OU** se sua branch for `master`:
```bash
git push origin master
```

## 🔍 Verificação dos Caminhos no HTML

Os caminhos no `index.html` estão corretos:
- ✅ Linha 451: `src="images/support-photo.jpg"`
- ✅ Linha 494: `src="images/marcio.jpg"`

## 🐛 Se as Imagens Ainda Não Aparecerem

1. **Verifique o nome exato dos arquivos** (case-sensitive):
   ```bash
   ls images/  # Linux/Mac
   dir images  # Windows
   ```

2. **Verifique se os arquivos estão no repositório remoto**:
   - Acesse seu repositório no GitHub
   - Verifique se a pasta `images/` existe
   - Verifique se os arquivos `support-photo.jpg` e `marcio.jpg` estão lá

3. **Limpe o cache do navegador** ao testar no GitHub Pages

4. **Use caminhos absolutos se necessário** (para GitHub Pages):
   - Se seu repositório é `usuario/repositorio`, use:
   - `src="/repositorio/images/support-photo.jpg"` (com barra inicial)
   - OU `src="./images/support-photo.jpg"` (caminho relativo explícito)

## 📝 Nota sobre .gitignore

O arquivo `.gitignore` atual **NÃO** está ignorando a pasta `images`, então o comando `git add -f` deve funcionar normalmente. O `-f` (force) garante que mesmo se houver alguma regra ignorando, os arquivos serão adicionados.

