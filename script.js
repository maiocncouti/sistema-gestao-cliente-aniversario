function normalizeText(value) {
    return value
        ? value.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : '';
}

function findProductByBarcode(barcode) {
    if (!barcode) return null;
    const code = barcode.toString().trim();
    return products.find(p =>
        (p.codigoBarras && p.codigoBarras.toString() === code) ||
        (p.barcode && p.barcode.toString() === code) ||
        (p.sku && p.sku.toString() === code)
    ) || null;
}

function fillSaleFieldsForProduct(product) {
    if (!product) return;
    const nomeProduto = product.nome || product.name || 'DIVERSOS';
    const codigoBarras = product.codigoBarras || product.barcode || '';
    const precoVenda = product.precoVenda || product.salePrice || 0;
    
    document.getElementById('sale-quantity').value = 1;
    document.getElementById('sale-description').value = nomeProduto;
    document.getElementById('sale-barcode').value = codigoBarras;
    document.getElementById('sale-unit-value').value = precoVenda;
}

function focusDescriptionField() {
    setTimeout(() => {
        const descriptionField = document.getElementById('sale-description');
        if (descriptionField) {
            descriptionField.focus();
            descriptionField.select();
        }
    }, 50);
}

function updateSalePanelVisibility() {
    const saleItemsContainer = document.getElementById('sale-items-container');
    const productPanel = document.getElementById('product-search-inline-panel');
    const clientPanel = document.getElementById('client-search-inline-panel');
    if (productPanel) productPanel.style.display = isProductSearchOpen ? 'flex' : 'none';
    if (clientPanel) clientPanel.style.display = isClientSearchOpen ? 'flex' : 'none';
    if (saleItemsContainer) {
        saleItemsContainer.style.display = (!isProductSearchOpen && !isClientSearchOpen) ? 'block' : 'none';
    }
}

function closeClientSearch() {
    isClientSearchOpen = false;
    selectedClientIndex = -1;
    updateSalePanelVisibility();
}

function formatEMV(id, value) {
    const length = value.length.toString().padStart(2, '0');
    return `${id}${length}${value}`;
}

function calculateCRC16(payload) {
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
            crc &= 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function generatePixPayload(value, pixKey, merchantName) {
    const sanitizedKey = pixKey.replace(/\s+/g, '');
    const gui = formatEMV('00', 'br.gov.bcb.pix');
    const keyField = formatEMV('01', sanitizedKey);
    const merchantInfo = formatEMV('26', gui + keyField);
    const merchantNameField = formatEMV('59', (merchantName || 'RECEBEDOR').toUpperCase().substring(0, 25));
    const amountField = formatEMV('54', value.toFixed(2));
    let payload =
        formatEMV('00', '01') +
        formatEMV('01', '12') +
        merchantInfo +
        formatEMV('52', '0000') +
        formatEMV('53', '986') +
        amountField +
        formatEMV('58', 'BR') +
        merchantNameField +
        formatEMV('60', 'BRASIL') +
        formatEMV('62', formatEMV('05', '***'));
    payload += '6304';
    const crc = calculateCRC16(payload);
    return payload + crc;
}

function getPixPaymentData() {
    const combos = [
        { select: document.getElementById('payment-method-1'), value: document.getElementById('payment-value-1') },
        { select: document.getElementById('payment-method-2'), value: document.getElementById('payment-value-2') }
    ];
    for (const combo of combos) {
        if (!combo.select || !combo.value) continue;
        const methodName = combo.select.value;
        if (!methodName) continue;
        const method = paymentMethods.find(m => m.name === methodName);
        if (method && method.name && method.name.toLowerCase() === 'pix' && method.pixKey && method.pixRecipient) {
            const amount = parseFloat(combo.value.value) || 0;
            if (amount > 0) {
                return { amount, method };
            }
        }
    }
    return null;
}

function showPixPayment(data) {
    const pixInfo = document.getElementById('sales-pix-info');
    const qrEl = document.getElementById('sales-pix-qr');
    const keyEl = document.getElementById('sales-pix-key');
    const copyBtn = document.getElementById('sales-pix-copy');
    const logoImg = document.getElementById('sales-company-logo');
    const logoVideo = document.getElementById('sales-company-logo-video');
    const placeholderEl = document.getElementById('sales-logo-placeholder');
    if (!pixInfo || !qrEl || !keyEl) return;
    
    const payload = generatePixPayload(data.amount, data.method.pixKey, data.method.pixRecipient);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(payload)}`;
    qrEl.src = qrUrl;
    keyEl.textContent = `${data.method.pixRecipient || 'Recebedor'} • ${formatCurrency(data.amount)} • ${data.method.pixKey}`;
    pixInfo.dataset.payload = payload;
    pixInfo.style.display = 'flex';
    if (copyBtn) {
        copyBtn.onclick = () => copyPixPayload(payload);
    }
    // Esconder logo (imagem ou vídeo) e placeholder
    if (logoImg) logoImg.style.display = 'none';
    if (logoVideo) logoVideo.style.display = 'none';
    if (placeholderEl) placeholderEl.style.display = 'none';
}

function hidePixPayment() {
    const pixInfo = document.getElementById('sales-pix-info');
    if (pixInfo) {
        pixInfo.style.display = 'none';
        pixInfo.dataset.payload = '';
    }
    loadCompanyLogo();
}

function copyPixPayload(payload) {
    const data = payload || document.getElementById('sales-pix-info')?.dataset.payload;
    if (!data) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data);
    } else {
        const temp = document.createElement('textarea');
        temp.value = data;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
    }
}

// Armazenamento de dados
let clients = JSON.parse(localStorage.getItem('clients')) || [];
let products = JSON.parse(localStorage.getItem('products')) || [];
let brands = JSON.parse(localStorage.getItem('brands')) || [];
let categories = JSON.parse(localStorage.getItem('categories')) || [];
let editingProductId = null;
let selectedProductId = null;
let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
let editingSupplierId = null;
let selectedSupplierId = null;
let paymentMethods = JSON.parse(localStorage.getItem('paymentMethods')) || [];
let editingPaymentMethodId = null;
let sales = JSON.parse(localStorage.getItem('sales')) || [];
let receivables = JSON.parse(localStorage.getItem('receivables')) || [];
let currentSale = null;
let saleItemIndex = -1;
let discountType = 'percent'; // 'percent' ou 'real'
let globalDiscount = 0; // Desconto global da venda
let currentTotalLiquid = 0; // Total calculado da venda (antes dos pagamentos)
let currentTotalPaid = 0; // Soma paga
let currentRemainingTotal = 0; // Valor restante a pagar
let selectedProductIndex = -1; // Índice selecionado na lista de produtos
let productSearchResults = []; // Resultados atuais da pesquisa
let isProductSearchOpen = false;
let selectedClientIndex = -1;
let clientSearchResults = [];
let isClientSearchOpen = false;
// Carregar dados da empresa do localStorage
let savedCompanyData = JSON.parse(localStorage.getItem('companyData')) || {};
let companyData = {
    name: savedCompanyData.name || 'Nome da Empresa',
    logo: savedCompanyData.logo || '',
    ownerName: savedCompanyData.ownerName || '',
    ownerContact: savedCompanyData.ownerContact || '',
    ownerEmail: savedCompanyData.ownerEmail || '',
    ownerBirthdate: savedCompanyData.ownerBirthdate || '',
    address: savedCompanyData.address || '',
    description: savedCompanyData.description || '',
    supportImage: savedCompanyData.supportImage || '',
    headerImage: savedCompanyData.headerImage || ''
};
let sentGreetings = JSON.parse(localStorage.getItem('sentGreetings')) || {}; // {clientId: timestamp}
let selectedClientId = null;
let licenseData = JSON.parse(localStorage.getItem('licenseData')) || null;
let licenseActivations = JSON.parse(localStorage.getItem('licenseActivations')) || {}; // {key: {year: activationDate}}
let used3DayKey = JSON.parse(localStorage.getItem('used3DayKey')) || false; // Chave de 3 dias só pode ser usada uma vez
let usedAnnualKeys = JSON.parse(localStorage.getItem('usedAnnualKeys')) || {}; // {key: true} - chaves anuais usadas

// Controle de Salvamento Automático
let autoSaveEnabled = JSON.parse(localStorage.getItem('autoSaveEnabled'));
if (autoSaveEnabled === null) {
    autoSaveEnabled = true; // Por padrão, ativado
    localStorage.setItem('autoSaveEnabled', JSON.stringify(true));
}

// Sistema de Usuários
let users = JSON.parse(localStorage.getItem('users')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let editingUserId = null;
let selectedUserForSwitch = null; // Usuário selecionado para troca (apenas senha será solicitada)

// Sistema de Logs
let systemLogs = JSON.parse(localStorage.getItem('systemLogs')) || [];
let logRetentionDays = parseInt(localStorage.getItem('logRetentionDays')) || 30; // Padrão: 30 dias

// Controle de remoção de clientes na tela de felicitações (por ano)
let removedGreetingClients = JSON.parse(localStorage.getItem('removedGreetingClients')) || {}; // {2025: {clientId: true}}

// Configurações do card de aniversários do dashboard
let birthdayCardSettings = JSON.parse(localStorage.getItem('birthdayCardSettings')) || {
    mode: 'today_range1_range2', // 'today', 'today_range1', 'today_range1_range2'
    range1Days: 7,
    range2Days: 30
};

// Configurações dos botões de navegação
let buttonStyleSettings = JSON.parse(localStorage.getItem('buttonStyleSettings')) || {
    textColor: '#ffffff',
    bgColor: 'rgba(255,255,255,0.2)',
    transparentBg: false,
    borderColor: 'rgba(255,255,255,0.3)',
    borderEnabled: true
};

// Timeout de sessão (5 minutos em milissegundos)
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutos

// Sistema de Personalização de Tema por Usuário
let userThemeSettings = JSON.parse(localStorage.getItem('userThemeSettings')) || {};
let inactivityTimeoutSettings = JSON.parse(localStorage.getItem('inactivityTimeoutSettings')) || {
    admin: { hours: 0, minutes: 0 },
    funcionario: { hours: 0, minutes: 0 }
};
let userPermissions = JSON.parse(localStorage.getItem('userPermissions')) || {};
let editingPermissionsUserId = null;
let sessionTimeoutId = null;

// Inicializar usuários padrão se não existirem
function initializeDefaultUsers() {
    // Dados atualizados do usuário Coutinho
    const coutinhoData = {
        id: 'coutinho-default',
        name: 'Maicon Coutinho',
        username: 'Coutinho',
        password: 'Coutinho@89',
        birthdate: '1989-12-07',
        phone: '41988192359',
        email: 'mcn.coutinho@gmail.com',
        photo: '',
        accessLevel: 'admin',
        isDefault: true, // Não pode ser excluído
        createdAt: new Date().toISOString()
    };
    
    // Dados atualizados do usuário admin
    const adminData = {
        id: 'admin-default',
        name: 'Marcio Mendes',
        username: 'admin',
        password: 'admin',
        birthdate: '',
        phone: '41998734231',
        email: 'mendesmarciodji@gmail.com',
        photo: '',
        accessLevel: 'admin',
        isDefault: true, // Não pode ser excluído
        createdAt: new Date().toISOString()
    };
    
    const hasUsers = users.length > 0;
    
    if (!hasUsers) {
        // Criar ambos os usuários
        users = [coutinhoData, adminData];
        saveUsers();
    } else {
        // Garantir que os usuários padrão existam e estejam atualizados
        const coutinhoIndex = users.findIndex(u => u.id === 'coutinho-default' || (u.username && u.username.toLowerCase() === 'coutinho'));
        const adminIndex = users.findIndex(u => u.id === 'admin-default' || (u.username && u.username.toLowerCase() === 'admin'));
        
        if (coutinhoIndex !== -1) {
            // Atualizar dados do Coutinho mantendo foto se existir
            users[coutinhoIndex] = {
                ...coutinhoData,
                photo: users[coutinhoIndex].photo || '', // Manter foto existente
                createdAt: users[coutinhoIndex].createdAt || new Date().toISOString()
            };
        } else {
            // Criar usuário Coutinho
            users.push(coutinhoData);
        }
        
        if (adminIndex !== -1) {
            // Atualizar dados do admin mantendo foto se existir
            users[adminIndex] = {
                ...adminData,
                photo: users[adminIndex].photo || '', // Manter foto existente
                createdAt: users[adminIndex].createdAt || new Date().toISOString()
            };
        } else {
            // Criar usuário admin
            users.push(adminData);
        }
        
        saveUsers();
    }
}

// Chaves de licença por dia do ano (365 chaves)
const licenseKeys = {
    '01/01': 'WRMQ-471N-1I5U-8I53',
    '02/01': 'BQOG-8V4L-PMQG-VZXE',
    '03/01': 'HHLS-M82J-QIQZ-938Y',
    '04/01': 'XIIC-WP0E-LX31-T5FU',
    '05/01': 'TEOT-8KSW-R74C-XEM1',
    '06/01': 'KHZU-9I9N-GPHS-56IH',
    '07/01': 'IK6E-2KXQ-EF2O-S0I7',
    '08/01': 'I8KX-BOJH-P3OO-RI0E',
    '09/01': 'JTFJ-V6VA-RZOF-AWMK',
    '10/01': 'CD8N-4DOC-Z720-JV3B',
    '11/01': 'IAVK-U8VE-XIPS-HC5H',
    '12/01': 'LYQK-F6WO-5MVX-ELR7',
    '13/01': 'MLAF-VQSW-A7H0-ZVQG',
    '14/01': 'RTKE-N8W1-O8KC-UKWW',
    '15/01': 'SMLW-ZBEB-NNUK-4I1J',
    '16/01': 'X4JA-LSE9-BWJL-232L',
    '17/01': 'CSNF-J1KR-570W-GP1E',
    '18/01': 'DZYN-SUKT-CVS7-VHK3',
    '19/01': 'M4R3-XLYO-Z3KX-HGZT',
    '20/01': 'QS4Q-NGHC-GN4E-Q9BK',
    '21/01': 'DEUR-W7EL-MLJ6-1DWJ',
    '22/01': 'T9Y9-NOVH-S9UW-HA9T',
    '23/01': 'W6JL-U4QT-5LMV-VK4L',
    '24/01': 'ZSNV-AUE0-DMUO-AG23',
    '25/01': 'UNUN-AOIM-IFC8-CJ5E',
    '26/01': 'LR95-H63Z-JT2F-QRY5',
    '27/01': 'VZGY-C1ND-DX55-B175',
    '28/01': 'G6VP-5JGO-OF7B-XWX0',
    '29/01': 'I9BZ-F6BU-V18J-82GB',
    '30/01': 'SWHP-5P4D-EBKL-E5GD',
    '31/01': 'W4FE-PXHI-KQ19-IMMN',
    '01/02': 'T391-37ZZ-VNUY-N33T',
    '02/02': 'ASIN-OCBZ-MD2A-QRSD',
    '03/02': 'VHDV-E4MI-CZP3-XJFX',
    '04/02': 'MAPR-I71X-35GD-1OQO',
    '05/02': '3KQ2-AJ6I-3LPC-TPIU',
    '06/02': '099D-343D-1U8W-6XUD',
    '07/02': 'KPGU-FH7M-WXRB-Q64Y',
    '08/02': 'ZR1F-A0NE-C40X-8EOX',
    '09/02': '1E6G-KSC0-MX6D-SIVG',
    '10/02': 'URCV-N0XP-ZZ9V-WCN2',
    '11/02': 'D8B1-1VGW-9VCA-56H8',
    '12/02': 'TXFR-SLZ9-QCK0-2EXH',
    '13/02': 'K9YN-UK96-YWZG-4H7R',
    '14/02': 'XK8J-URH7-UX0Y-BB0Z',
    '15/02': 'DZA1-PVB8-0AV1-MAGS',
    '16/02': 'UVA5-A7YT-3GL8-Q8GH',
    '17/02': '82W8-9QCM-KZ0D-474C',
    '18/02': 'Z1G8-OLRN-4L9M-RWIO',
    '19/02': '009S-MRPT-NN1O-600C',
    '20/02': '5JCA-XTJ5-35ST-5VJZ',
    '21/02': '6N7Y-EIQE-GR18-Y05M',
    '22/02': 'ZVZS-W4HC-3M68-4TGH',
    '23/02': 'SZ2Z-0B5R-6APF-D5P0',
    '24/02': 'E5JC-VB9L-LTHO-SV3Q',
    '25/02': '8764-QUBV-H2UW-ZIDZ',
    '26/02': 'O4Q7-MEY0-BU77-93I8',
    '27/02': '90X5-YQE3-K65M-OUDM',
    '28/02': '26F7-5MFE-9WBD-29NE',
    '29/02': 'TRKQ-RLPE-ZQTR-M7H8',
    '01/03': 'TESP-YRUB-2Y37-B02O',
    '02/03': 'A80Z-Y58U-HQ6R-I0ON',
    '03/03': 'I2KL-A6JT-F98R-HULU',
    '04/03': 'VOA0-KJSC-TO8N-XO76',
    '05/03': 'XMZA-ERVG-I3FG-RIBF',
    '06/03': 'DSBO-MQ6S-13X9-2W7F',
    '07/03': 'KRCD-CQCS-QIOC-XI4U',
    '08/03': 'KCN4-I2H3-OMFR-SYNG',
    '09/03': '2WZN-KKPG-KJLQ-46KV',
    '10/03': 'A73B-ZE2U-H8J9-QXUC',
    '11/03': 'PM3F-VODP-BV5M-3TF9',
    '12/03': 'PT24-QFBG-HWLB-NEUP',
    '13/03': '0IR1-A23D-HZZR-TXO0',
    '14/03': '3DFP-FSRU-V51K-16YM',
    '15/03': '4O82-VFQJ-JSGC-89TL',
    '16/03': 'LS91-QSW8-I0BU-MAQF',
    '17/03': 'QUE4-VCZ4-EGUE-2XTQ',
    '18/03': '6ZEU-8Q10-4RP2-7R5W',
    '19/03': 'RJWR-X643-Q8SS-WCDS',
    '20/03': 'E08K-IOUB-U2AH-KX70',
    '21/03': '6MUD-TOLP-Q2MJ-7OM7',
    '22/03': 'RTEC-KHID-WS4H-3UJP',
    '23/03': '19KD-8A5Z-X84X-AQTS',
    '24/03': 'POYI-AXFN-69PE-N424',
    '25/03': '837N-ATCT-IYBZ-OOE0',
    '26/03': '2Z72-X434-RN63-VU4J',
    '27/03': 'X74I-GPY7-RYWI-2Q56',
    '28/03': '3WJP-UOL0-3Z2E-GY9U',
    '29/03': 'YYYU-WRHT-V8JF-1ST0',
    '30/03': 'OZC9-3QI4-Y1T3-RMGD',
    '31/03': 'EH40-9BHH-F07D-HSCF',
    '01/04': 'N7OS-9ZGJ-0A7S-FQAQ',
    '02/04': '5MGF-SW47-QVO5-VYWO',
    '03/04': 'ZXKQ-U3HU-KF1R-TYO8',
    '04/04': 'EQAG-NHOU-5C6A-1HPR',
    '05/04': '3SVG-U0AL-XZYS-GNWR',
    '06/04': 'S9BR-7MZ5-UUQ3-B4PM',
    '07/04': '6L7N-1UBS-ILE7-FMPD',
    '08/04': 'MLK2-99EB-JPFH-8NBU',
    '09/04': 'SXGP-11MC-ZW03-QLIS',
    '10/04': 'UHQ1-3BO4-QZ9V-Z7FR',
    '11/04': 'MT5A-97JS-3FE8-1S3N',
    '12/04': '7G38-HQ4A-I3DB-MV3L',
    '13/04': 'RKJM-5G65-D6IG-AKG8',
    '14/04': '9AA7-FR3A-62GH-6SCR',
    '15/04': 'GPSV-R3KI-VPXL-D608',
    '16/04': '3T3I-W90R-UAKQ-XYVL',
    '17/04': 'X2XS-0932-D95L-5GQP',
    '18/04': 'O3MH-GJV7-9XYC-9HDZ',
    '19/04': '67ZN-EWX1-HKTT-LDUH',
    '20/04': '0BFH-1WQZ-2ZUT-JCGZ',
    '21/04': '7XY9-2WZV-8RI3-AORB',
    '22/04': '0EEY-Z9EU-TBJO-4CY9',
    '23/04': 'XLCQ-9OPX-WYNJ-BP9E',
    '24/04': 'LV1V-5ALA-97W7-X0EE',
    '25/04': 'MOVP-ICJC-S6J8-G9AI',
    '26/04': 'XBV2-G5LN-3NEW-B1DM',
    '27/04': 'PMEK-35P4-ZKI7-KRWD',
    '28/04': 'HOTA-NDN5-PQBR-0E1Q',
    '29/04': '8JEY-20LY-A9JM-28XW',
    '30/04': 'B90Q-RD0D-0IGM-6F1L',
    '01/05': '2DTA-6TXS-C95H-4GQ7',
    '02/05': 'H9WB-EUAN-ZCTV-COMQ',
    '03/05': 'N0M4-6WTW-6HCJ-QX42',
    '04/05': 'NDZJ-FODZ-OIZJ-YPXA',
    '05/05': 'NY6T-HYXG-RQRP-MEPB',
    '06/05': '6BFP-ATI1-FF3L-SHHD',
    '07/05': 'R8ZT-JEC5-FB0P-ZGZJ',
    '08/05': 'H9BE-1GD7-O0YC-ZTS7',
    '09/05': 'QY36-S2AM-V8ME-FJU8',
    '10/05': 'ZSL1-SY2V-PYTE-02S5',
    '11/05': 'FS06-2JFF-DRB4-SM4X',
    '12/05': 'W4LU-F6DQ-MAU6-H944',
    '13/05': 'BHGY-87GO-T0AM-J10E',
    '14/05': 'DA88-CIFV-B5CK-N2J6',
    '15/05': 'U7KK-UVGU-0GFV-HPKS',
    '16/05': '6J7H-4Y8H-8J6U-SNHY',
    '17/05': 'IMSQ-4K3V-OWA3-9ZZ2',
    '18/05': 'R3WZ-R7D4-DEZN-LX5I',
    '19/05': 'Z8SC-W994-MC76-7X6Z',
    '20/05': 'XINF-WXH1-BH0S-OYEP',
    '21/05': 'IY00-ZFWR-TWVO-X7MR',
    '22/05': 'WJBG-FRKW-C2TV-AL16',
    '23/05': '6E3L-CTV7-F4GJ-VVUK',
    '24/05': '49F5-4MS6-HDW8-TC3J',
    '25/05': 'T5D3-KX23-LDBC-X03M',
    '26/05': 'K26B-3SLR-LGR3-8EK0',
    '27/05': 'HT79-Z9IY-HI1N-YXR3',
    '28/05': 'KWC9-BHGX-RFMS-SSCI',
    '29/05': 'W40D-IM51-LGIE-1031',
    '30/05': 'HM9G-5DV6-9YYQ-L3X5',
    '31/05': 'J54J-6F88-7Q94-QOZ4',
    '01/06': 'H4SV-CEH4-3STE-V5SH',
    '02/06': 'PLTN-14AW-HFKA-Q5CK',
    '03/06': 'WHD3-NNXU-8Z68-62HV',
    '04/06': 'XI15-D1Z6-CFNZ-9XO5',
    '05/06': 'WPZJ-69XP-EGYN-7KF3',
    '06/06': 'LN26-WKCM-Q7CA-7ME5',
    '07/06': 'O21W-1KIR-DUCT-ZGHK',
    '08/06': '2U6T-Q3JF-IUZ9-WW2Q',
    '09/06': '78LD-JNCA-AD48-AISL',
    '10/06': 'YHOX-3N7N-33F6-V6NU',
    '11/06': 'LVT4-8YXQ-R793-1F1B',
    '12/06': 'FB49-5O0M-UYX5-X4BE',
    '13/06': 'YMQR-LDBI-RVXJ-DZQ0',
    '14/06': 'E0OB-DP6B-3TG9-YNKM',
    '15/06': 'YLGV-IASA-8ZHF-HASI',
    '16/06': 'D2GU-I35G-FQEL-THH0',
    '17/06': 'LB7J-GSZE-X2T1-5X75',
    '18/06': 'BQDW-E7JE-O30A-4LSX',
    '19/06': '1O45-73U1-HEWS-7ZFZ',
    '20/06': 'UJU0-9CAQ-8TRA-LPK6',
    '21/06': '4LKV-YZL1-QAMR-T6B7',
    '22/06': 'MG4X-C1UC-ZVUT-JXZL',
    '23/06': 'BXAJ-TXZ4-WRK4-TDMM',
    '24/06': 'OGKJ-TZI0-7Q9A-I4IC',
    '25/06': 'CZWY-66Q6-M5LR-WVTI',
    '26/06': 'KY3D-70ZD-8B1M-VMBK',
    '27/06': 'RQ1R-WDMG-NFD6-N7GW',
    '28/06': '28M2-4VYJ-7TO7-DTI9',
    '29/06': '8C05-Z3AK-4X0E-P8SJ',
    '30/06': '1CO0-BDY5-A37C-UUMS',
    '01/07': '90YJ-GB50-BQX6-ZHV8',
    '02/07': 'JR11-TBI7-CI1U-YM2K',
    '03/07': 'CN3F-0VJH-WPZW-IONO',
    '04/07': 'PRK0-QIUK-1CSI-M2DR',
    '05/07': 'SZXP-D93W-95G2-P3FP',
    '06/07': '83WZ-Y33Y-DLRW-0AZL',
    '07/07': 'OT3H-EFZV-IQR9-GM5M',
    '08/07': '7K4H-L5IO-C1DC-FM41',
    '09/07': '5WI4-2G60-RBLQ-IPT5',
    '10/07': 'BURB-VA58-XCNT-7IF7',
    '11/07': '8TLW-3KPN-FZVW-Q8XG',
    '12/07': 'EZTK-ERCS-KPQS-JKN3',
    '13/07': '6ZAQ-BXGP-3GZP-XHH0',
    '14/07': 'EUFP-RO0Y-NY50-DQ9A',
    '15/07': 'CSDU-RAHZ-VNU7-0I9I',
    '16/07': 'IIRS-B5EL-DVVR-QXHA',
    '17/07': 'V6JB-LBDC-WVVU-PY9P',
    '18/07': 'G6BV-UZEN-7HPA-4UT1',
    '19/07': '19BF-RU3W-Q3PO-63X6',
    '20/07': 'BSM0-8F2N-QNLR-MSDL',
    '21/07': '2WQO-NXRM-P7TR-6LNC',
    '22/07': 'RMEK-XA1Q-DV1M-V7TO',
    '23/07': 'H8UT-CWWO-T7W1-88QB',
    '24/07': '3C8I-S6U6-6PDO-TB1H',
    '25/07': 'TMV4-RRDD-MXCW-X1S2',
    '26/07': 'HRWW-DN94-2OS2-JVXC',
    '27/07': '1LYR-D6U3-44RI-GPIP',
    '28/07': '0V8Q-28VT-ATW6-VX2V',
    '29/07': 'JL47-U817-IA5U-5F1L',
    '30/07': 'Z1QY-RVGB-JF31-GWBI',
    '31/07': '8LR7-BEAS-VMJ7-GV9X',
    '01/08': '55TB-8B4Q-SP5P-UR2Z',
    '02/08': 'AQES-4U9Z-FZES-6T00',
    '03/08': 'XUEE-U54C-XDA9-GBQ1',
    '04/08': '4NDZ-LJDP-WEEQ-1VKY',
    '05/08': '244T-3WLZ-V1O9-4LAO',
    '06/08': 'J5GK-KKX0-DPNF-AMRF',
    '07/08': 'ECWP-T2XJ-16US-7DC7',
    '08/08': 'H6SO-MOVR-3F2X-M7DR',
    '09/08': '9QAY-3UR5-HJCW-LWAT',
    '10/08': '2YOW-I2CF-ZVS5-KYYN',
    '11/08': 'L5AF-5SEY-EGQN-T2F3',
    '12/08': 'ZOAG-H6C0-MI89-GIZ6',
    '13/08': 'O67E-ML05-WPM5-V2I5',
    '14/08': 'SUV4-O6KY-KTWC-GQD1',
    '15/08': 'OVDY-AEXW-QH3P-GFSF',
    '16/08': 'KSGB-BSRS-CSA6-6YRC',
    '17/08': 'CCC3-ZWPL-UG74-MOS5',
    '18/08': 'JTVQ-IVR4-ETWW-BL7F',
    '19/08': 'NYLU-ALZA-DUAS-E88L',
    '20/08': 'GM85-26W6-Q1AG-1VZI',
    '21/08': '9ZVW-GDK9-K8VP-IDI7',
    '22/08': 'I38N-N6IW-C9WO-EQC3',
    '23/08': 'AD4F-UKTE-CTHA-2XG6',
    '24/08': '820E-5NOE-I924-IYBR',
    '25/08': 'QAOE-R2UX-AH9C-OYZE',
    '26/08': '0AC2-NW2X-CWGK-3NSJ',
    '27/08': 'IE2P-BXXT-ADDM-VBVN',
    '28/08': 'BV9N-UEVH-02Z4-STZV',
    '29/08': '7UFE-K21H-O0DH-BWAQ',
    '30/08': 'AME3-UFM2-28QP-Z7GF',
    '31/08': 'RM4U-CEZU-07DG-GGIL',
    '01/09': 'XDAJ-PA9M-B3WV-F612',
    '02/09': 'CBAR-SE6Q-M71F-W5XC',
    '03/09': 'ZLWI-6MF1-7UZZ-VOO1',
    '04/09': 'LHIY-ZVVE-R24X-PD0Z',
    '05/09': '4W0O-K7XW-E1G9-EU8E',
    '06/09': 'BO7M-JHIN-R682-6XQM',
    '07/09': 'QF4N-P5X5-LPIL-J28N',
    '08/09': 'HP1U-OECK-EM4H-AS98',
    '09/09': 'GD6M-NDPF-BS9J-RFEN',
    '10/09': 'D9KE-GCMY-BXG2-M5O8',
    '11/09': 'CY93-21RK-NW0A-TWYR',
    '12/09': 'DRQH-PIP9-HZ3B-8HFD',
    '13/09': 'V2NL-XH7G-EAA1-0JTZ',
    '14/09': 'J9WS-3BT7-LK8P-DUJD',
    '15/09': 'DC8B-3O9E-YVOR-7KAR',
    '16/09': '2J3U-BF60-ZWRX-XM6S',
    '17/09': 'HQO7-N6E9-U6E3-F53X',
    '18/09': 'UH4Q-2WQB-YLCN-S7L2',
    '19/09': 'ULT3-L44W-SQRC-OVRU',
    '20/09': 'LQT5-K2S4-RMC2-ZB82',
    '21/09': 'AKYK-ML6T-GB7Y-6FSC',
    '22/09': 'YZSO-NS74-UARH-SACJ',
    '23/09': 'J5C7-M8KS-92IU-8TO7',
    '24/09': '3GKS-H25S-DQY3-XM4P',
    '25/09': 'KNFL-AI4J-PAJG-8X6T',
    '26/09': 'QVHJ-A341-9V8Z-7PL4',
    '27/09': 'YPZL-7JVU-B8C9-WFRQ',
    '28/09': 'QNR5-UVJU-5TU2-OWX2',
    '29/09': 'ZT6B-CX08-MRL5-OIG4',
    '30/09': 'XZYX-V7Y3-KFAQ-LE3G',
    '01/10': 'JVVY-GOAM-7CPJ-W37X',
    '02/10': 'XFYX-4X87-7YM9-5JMO',
    '03/10': 'Q07C-DQ7F-YAOR-TDTL',
    '04/10': '7VQ0-SPOI-MTBH-4U0E',
    '05/10': 'CIND-XGLZ-GUH3-YTCZ',
    '06/10': 'YEC7-F2FZ-AXV4-CFMP',
    '07/10': '1ZPQ-WOTN-R9FO-N2PA',
    '08/10': 'PQ1N-JXUU-BQTL-KYY9',
    '09/10': 'E3ZS-WL7E-RUWP-2GJG',
    '10/10': '133T-EYVU-2VGD-5QAC',
    '11/10': 'PCS7-3DHZ-P1IG-ZW3O',
    '12/10': 'N4IQ-DHP6-QRHS-RUNZ',
    '13/10': '46MD-3NRO-5LKG-R8I3',
    '14/10': 'TFGQ-ECZQ-KJA9-KZXU',
    '15/10': '6JL7-Z8R3-C7RD-ZCRE',
    '16/10': 'RGQG-M6U4-FMWE-4LK7',
    '17/10': 'WSQO-Z4HT-GUW9-JSXD',
    '18/10': 'JPEM-6LEJ-1A8I-QXEP',
    '19/10': '5LKS-YVBR-A6IH-XRPU',
    '20/10': 'BHB0-XLY2-SCCB-4SMJ',
    '21/10': 'QWID-F9QL-BXWU-UJFV',
    '22/10': 'ADVH-O9ZF-SFCU-PP9L',
    '23/10': 'I7SB-ZEMO-URD1-OZ50',
    '24/10': 'TRX0-MRVQ-LKL0-HFI6',
    '25/10': 'SZBF-0HP6-WZ7X-KC99',
    '26/10': 'NMU0-XGA8-QU33-Q8VJ',
    '27/10': 'PHMT-MLX2-Q8ZX-JZG8',
    '28/10': 'P10E-DGBL-BCNE-MBHC',
    '29/10': 'W10V-OQHH-MOYR-RVXT',
    '30/10': 'JHRA-NFO2-7PNV-6OWT',
    '31/10': '292P-AK4P-C7DY-VRLU',
    '01/11': 'Y8SM-T4YK-TQUR-4XSO',
    '02/11': 'T8FM-ZX5H-VR02-9W6U',
    '03/11': 'H7CU-IBWS-WX7G-KRK6',
    '04/11': 'QX8A-IY7H-ZWD3-EEYV',
    '05/11': 'M711-G5EM-97B0-G1DV',
    '06/11': 'XHHW-0BBJ-LSA9-2EGA',
    '07/11': '0PIK-KWP0-11AV-W36Z',
    '08/11': 'YLCK-M86J-02LQ-I75G',
    '09/11': 'AFHG-M8B9-1XSJ-2OUG',
    '10/11': 'OR5B-H8XF-60HI-UD7W',
    '11/11': 'FY12-6T7V-XAGM-0ZP3',
    '12/11': '0P7N-BEDE-KVJH-ZQZ1',
    '13/11': 'GQH6-6XP1-B3CV-ZJDL',
    '14/11': 'OB7L-5IJR-SKN3-SAS8',
    '15/11': 'DR7C-3ET6-SLPB-9RCT',
    '16/11': 'Z6VE-4S85-4789-NW89',
    '17/11': 'M4ZJ-46FS-OT5B-YMRQ',
    '18/11': '4MBL-Z99H-LLRC-2SQ6',
    '19/11': 'TMCY-FU7M-YSXG-RX8E',
    '20/11': 'QNF1-1EVU-DIUX-FP4A',
    '21/11': '9OHL-HS1Q-Y5Q8-RHJ3',
    '22/11': '5W2X-01F3-9Q5E-UPN7',
    '23/11': 'WZW0-OPX1-FGF5-VGDC',
    '24/11': '166O-UKS5-MW1R-QW17',
    '25/11': 'JMR9-XXUO-E6HB-LVCW',
    '26/11': '8J6X-OX59-ZS3R-D5B7',
    '27/11': 'YB6E-95XO-C31J-571E',
    '28/11': 'TV6Z-T3Q6-03YB-KF73',
    '29/11': 'LP6N-4093-KOAH-L668',
    '30/11': 'Y5PX-4UZS-XK16-UAIK',
    '01/12': 'YUU7-M3HQ-FJPX-YXPA',
    '02/12': '6K6B-FLE9-E20A-K5G5',
    '03/12': 'AWLM-4H5Q-VQ45-J3TH',
    '04/12': 'O6XO-PGSH-Q5WN-GR34',
    '05/12': 'OEVD-89HJ-9PAK-A6S0',
    '06/12': 'ISXJ-H3FI-J1IJ-MP6Z',
    '07/12': 'WHR2-W69T-YXKM-AF3M',
    '08/12': 'IOS5-VKA5-SGBM-4WLO',
    '09/12': 'NWCY-6Q8A-A1IO-360J',
    '10/12': 'B9Z8-ISEK-RKDT-4NRW',
    '11/12': 'PQ48-DASP-AIGQ-PUAQ',
    '12/12': 'CTAI-OA9G-NRGD-2FH3',
    '13/12': '1GNA-D16T-TRD0-OGQT',
    '14/12': '9QO1-CHDS-L8GO-ONVF',
    '15/12': 'LT4S-Y8TB-9EP8-2IM6',
    '16/12': '9I0T-7J8C-7G8N-5YBB',
    '17/12': 'SWKG-CFHN-EPD3-3J2J',
    '18/12': 'H5E2-8FV1-CCHL-1HLY',
    '19/12': '0RPE-N4CP-RWP3-EACY',
    '20/12': '6QKY-WPZX-1Q3Z-4JAK',
    '21/12': 'OSYA-VH7H-DC22-VNP5',
    '22/12': '3ZBX-QHUW-30WI-K896',
    '23/12': '4VSZ-L6F4-NR5K-6TFO',
    '24/12': 'PZ3N-AO1D-GOT3-EKN6',
    '25/12': 'L1B5-NCNU-9RR1-35PE',
    '26/12': 'JYV6-I1BC-6HX0-L1AX',
    '27/12': 'U1DX-T0H9-R44K-7Z88',
    '28/12': '2BGK-XBC9-2XFQ-3GV0',
    '29/12': 'Z186-MBEF-W61Q-ETLZ',
    '30/12': '7SD6-H2R7-PBV4-WAL6',
    // Chaves especiais
    'TEST-3DAY': 'TEST-3DAY-VY19-EUCL', // 3 dias, uso único
    'TEST-5MIN': 'TEST-5MIN-JOXS-RNM4'  // 5 minutos, uso ilimitado
};

// Chaves de licença anuais (50 chaves, uma para cada ano de 2025 a 2074)
const annualLicenseKeys = {
    2025: 'I59S-CS92-OQH0-WMXF',
    2026: '3G85-TW11-OAOF-RSG9',
    2027: 'PNRO-QP0E-8J20-CT3Z',
    2028: '0NHN-PU8K-ME58-VE0T',
    2029: '1XUR-AT3C-6EJ9-3PA6',
    2030: 'B9B1-FSHO-HJI8-BGX3',
    2031: 'ZLHA-K5NW-I5YJ-83LD',
    2032: '2J9S-SC1I-MA3C-YBSS',
    2033: 'CWVT-XWDN-2H10-9F9Z',
    2034: 'R2VY-1AE2-962X-7OOB',
    2035: 'Q2OZ-KCUW-X9KD-J323',
    2036: 'LFR4-U75J-55GJ-JJOF',
    2037: 'GIK1-CJSA-DWS2-U828',
    2038: 'O90C-AT8V-QSYE-JII6',
    2039: '6657-BBD0-6HU4-LDGU',
    2040: 'YWS0-T8H5-NG2F-YJ9G',
    2041: 'HZA1-0CDC-GK8R-2ZWR',
    2042: 'XLR1-H343-QM6N-X45F',
    2043: 'LVYV-VL5A-SC6J-QQAD',
    2044: 'XRRH-46NY-OH0U-AT4X',
    2045: 'CD0R-D5V8-IFB6-MPGB',
    2046: 'HXZM-YG4U-L68L-6WYW',
    2047: 'YSTY-L9BY-41C9-40H6',
    2048: 'SDJ7-KQWT-C844-5XCV',
    2049: 'TWAZ-AENL-VT1X-F5KT',
    2050: '8EVL-C1BU-KNHV-IDIL',
    2051: '63VZ-VN88-PWDT-7NQF',
    2052: '93GF-3JJL-75UU-GJAS',
    2053: 'BP01-LYUZ-OWIZ-GGF8',
    2054: 'F8H8-6YJI-4OQF-HCP3',
    2055: '51KT-FB1J-T34Q-IGXE',
    2056: 'OX6K-MT84-IAC5-QPX6',
    2057: 'PK0W-Q2GW-8ZTO-DBCB',
    2058: '15ZP-XFUA-QOBU-EI6X',
    2059: 'MIQB-0QSM-2ZJU-5QPP',
    2060: 'NCRB-GLC6-T30G-CM1M',
    2061: 'P0MO-ZYLW-9GHM-Y0IL',
    2062: 'T417-I2NH-DXRW-KB23',
    2063: 'AB42-X91Z-5ERY-K7QY',
    2064: 'LY78-F67C-ECD1-YPO8',
    2065: 'LNYF-D49J-C7WD-EERX',
    2066: 'EMDS-GV6J-SJQ0-6S76',
    2067: '94U8-HD22-XUKD-UXYF',
    2068: 'BWN7-LE69-B4C6-O4G8',
    2069: 'E1L3-UROI-27LA-LOD3',
    2070: 'UNMS-B52A-D3CW-ZH80',
    2071: 'WCOF-2946-GTZ0-NREQ',
    2072: 'YRK6-3SJQ-ZK36-JZU3',
    2073: 'CKUL-IG2L-CNK3-Y332',
    2074: 'C7OD-KURK-VE17-IBM9'
};

// Inicialização
// ============================================
// LÓGICA DA SPLASH SCREEN
// ============================================
// Função para inicializar a aplicação após a splash screen
function initializeApplication() {
    initializeApp();
    setupEventListeners();
    initializeDefaultUsers();
    loadCompanyData();
    
    // Verificar timeout de sessão antes de verificar login
    checkSessionTimeout();
    checkLoginStatus();
    
    loadClients();
    loadUsers();
    startBirthdayChecker();
    checkLicenseAndBlockAccess();
    updateLicenseExpirationMessage();
    updateLicenseStatusHeader();
    updateSupportImage();
    
    // Atualizar status da licença no header a cada segundo
    setInterval(updateLicenseStatusHeader, 1000);
    
    // Limpar logs antigos ao iniciar
    cleanOldLogs();
    cleanRemovedGreetingClientsHistory();
    
    // Atualizar última atividade em eventos de interação
    document.addEventListener('click', updateLastActivity);
    document.addEventListener('keypress', updateLastActivity);
    document.addEventListener('mousemove', updateLastActivity);
    
    // Carregar tema padrão na inicialização (antes do login)
    
    // Atualizar status do auto-save se a seção de backup estiver visível
    setTimeout(() => {
        if (document.getElementById('backup') && document.getElementById('backup').classList.contains('active')) {
            updateAutoSaveStatus();
        }
    }, 100);
    // O checkLoginStatus() irá carregar o tema do usuário se ele estiver logado
    applyDefaultTheme();
    
    // Após verificar o login, carregar tema do usuário se estiver logado
    setTimeout(() => {
        if (currentUser && currentUser.username) {
            loadUserTheme();
            setupThemeColorPicker();
        }
    }, 100);
}

function checkAndShowSplashScreen() {
    const FIVE_HOURS_MS = 18000000; // 5 horas em milissegundos
    const splashScreen = document.getElementById('splash-screen');
    const splashVideo = document.getElementById('splash-video');
    
    // Esconder o container principal IMEDIATAMENTE para bloquear acesso
    const container = document.querySelector('.container');
    if (container) {
        container.style.display = 'none';
    }
    
    if (!splashScreen || !splashVideo) {
        console.error('Splash screen ou vídeo não encontrado!');
        // Se a splash screen não existir, mostrar container e inicializar
        if (container) {
            container.style.display = '';
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeApplication);
        } else {
            initializeApplication();
        }
        return;
    }
    
    // Garantir que a splash screen esteja visível inicialmente
    splashScreen.style.display = 'flex';
    splashScreen.classList.remove('hidden');
    
    // 1. Verificar e Gerenciar o Contador Diário
    const today = new Date().toDateString();
    let videoShowCount = parseInt(localStorage.getItem('videoShowCount')) || 0;
    const videoLastDate = localStorage.getItem('videoLastDate');
    
    // Se a data mudou, resetar o contador
    if (videoLastDate !== today) {
        videoShowCount = 0;
        localStorage.setItem('videoShowCount', '0');
        localStorage.setItem('videoLastDate', today);
    }
    
    // 2. Calcular Tempo e Contagem
    const now = Date.now();
    const videoLastShowTime = parseInt(localStorage.getItem('videoLastShowTime')) || 0;
    const timeSinceLastShow = now - videoLastShowTime;
    const hasPassedFiveHours = timeSinceLastShow >= FIVE_HOURS_MS;
    
    // 3. Decisão de Exibição
    // Se nunca foi exibido (videoLastShowTime === 0), sempre mostrar
    const shouldShow = videoLastShowTime === 0 || hasPassedFiveHours || videoShowCount < 3;
    
    // Função para esconder splash e inicializar aplicação
    function hideSplashAndInitialize() {
        splashScreen.classList.add('hidden');
        setTimeout(() => {
            splashScreen.style.display = 'none';
            // Mostrar o container principal novamente
            if (container) {
                container.style.display = ''; // Restaurar display padrão
            }
            // Inicializar a aplicação após a splash screen desaparecer
            initializeApplication();
        }, 500); // Tempo do fade-out (0.5s)
    }
    
    if (shouldShow) {
        console.log('Mostrando splash screen - Condições atendidas');
        
        // Garantir que o container está escondido
        if (container) {
            container.style.display = 'none';
        }
        
        // MOSTRAR a splash screen
        splashScreen.style.display = 'flex';
        splashScreen.classList.remove('hidden');
        
        // Atualizar contador e timestamp ANTES de mostrar
        videoShowCount++;
        localStorage.setItem('videoShowCount', videoShowCount.toString());
        localStorage.setItem('videoLastShowTime', now.toString());
        localStorage.setItem('videoLastDate', today);
        
        // Função para iniciar a reprodução do vídeo
        function startVideoPlayback() {
            console.log('Iniciando reprodução do vídeo');
            
            // Verificar e definir a fonte do vídeo
            const source = splashVideo.querySelector('source');
            if (source && source.src) {
                // Usar a fonte do elemento source
                splashVideo.src = source.src;
                console.log('Fonte do vídeo definida do source:', splashVideo.src);
            } else if (!splashVideo.src) {
                // Fallback: definir manualmente (nome correto com hífen)
                splashVideo.src = 'videos/entrada-2-1.mp4';
                console.log('Fonte do vídeo definida manualmente:', splashVideo.src);
            }
            
            // Adicionar listener para erros de carregamento
            let errorCount = 0;
            let triedWebM = false;
            const errorHandler = function(e) {
                errorCount++;
                console.error('Erro ao carregar vídeo (tentativa ' + errorCount + '):', e);
                if (splashVideo.error) {
                    console.error('Código de erro:', splashVideo.error.code);
                    console.error('Mensagem:', splashVideo.error.message);
                    console.error('URL tentada:', splashVideo.src);
                }
                
                // Se o erro for de decodificação (código 4) e ainda não tentou WebM
                if (splashVideo.error && splashVideo.error.code === 4 && !triedWebM) {
                    // Erro de decodificação - tentar WebM
                    const webmSource = splashVideo.querySelector('source[type="video/webm"]');
                    if (webmSource) {
                        triedWebM = true;
                        console.log('Erro de decodificação MP4 detectado. Tentando formato WebM...');
                        splashVideo.src = webmSource.src;
                        splashVideo.load();
                        return;
                    }
                }
                
                // Se WebM também falhou ou não existe, continuar sem vídeo
                if (errorCount >= 2 || (triedWebM && splashVideo.error && splashVideo.error.code === 4)) {
                    console.warn('Não foi possível carregar o vídeo após ' + errorCount + ' tentativas (MP4 e WebM falharam), continuando sem ele');
                    console.warn('Possíveis causas: arquivo corrompido, codec incompatível ou arquivo não enviado completamente ao GitHub');
                    setTimeout(() => {
                        hideSplashAndInitialize();
                    }, 2000);
                    return;
                }
                
                // Se ainda não tentou WebM e não é erro de decodificação, tentar WebM
                if (!triedWebM && errorCount === 1) {
                    const webmSource = splashVideo.querySelector('source[type="video/webm"]');
                    if (webmSource) {
                        triedWebM = true;
                        console.log('Tentando formato WebM como alternativa...');
                        splashVideo.src = webmSource.src;
                        splashVideo.load();
                        return;
                    }
                }
                
                // Última tentativa: aguardar mais um pouco
                if (errorCount === 1) {
                    setTimeout(() => {
                        if (splashVideo.error) {
                            errorHandler(e);
                        }
                    }, 2000);
                } else {
                    console.warn('Não foi possível carregar o vídeo, continuando sem ele');
                    setTimeout(() => {
                        hideSplashAndInitialize();
                    }, 2000);
                }
            };
            
            splashVideo.addEventListener('error', errorHandler);
            
            // Resetar o vídeo para o início
            splashVideo.currentTime = 0;
            
            // Carregar o vídeo novamente para garantir que está pronto
            splashVideo.load();
            
            // Aguardar o vídeo estar pronto para reproduzir
            const onCanPlay = function() {
                console.log('Vídeo pronto para reproduzir');
                // Tentar reproduzir o vídeo
                const playPromise = splashVideo.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        // Vídeo começou a reproduzir com sucesso
                        console.log('Vídeo iniciado com sucesso');
                    }).catch(error => {
                        console.error('Erro ao reproduzir vídeo:', error);
                        // Se houver erro, continuar mesmo assim após um tempo
                        setTimeout(() => {
                            hideSplashAndInitialize();
                        }, 3000);
                    });
                }
            };
            
            // Verificar se o vídeo já está pronto
            if (splashVideo.readyState >= 3) {
                // Vídeo já tem dados suficientes
                console.log('Vídeo já está pronto, reproduzindo imediatamente');
                onCanPlay();
            } else {
                // Aguardar o vídeo estar pronto
                splashVideo.addEventListener('canplaythrough', onCanPlay, { once: true });
                splashVideo.addEventListener('loadeddata', function() {
                    console.log('Dados do vídeo carregados');
                    // Se canplaythrough não foi disparado, tentar reproduzir mesmo assim
                    if (splashVideo.readyState >= 2) {
                        setTimeout(onCanPlay, 100);
                    }
                }, { once: true });
                
                // Fallback: se o vídeo não carregar em 5 segundos, tentar reproduzir mesmo assim
                setTimeout(() => {
                    if (splashScreen.style.display !== 'none' && splashScreen.style.display === 'flex') {
                        console.log('Timeout - tentando reproduzir vídeo mesmo assim');
                        if (splashVideo.readyState >= 2) {
                            onCanPlay();
                        } else {
                            // Se ainda não carregou, continuar sem vídeo
                            console.warn('Vídeo não carregou a tempo, continuando sem ele');
                            hideSplashAndInitialize();
                        }
                    }
                }, 5000);
            }
            
            // Aguardar o vídeo terminar completamente
            splashVideo.addEventListener('ended', function() {
                console.log('Vídeo terminou');
                hideSplashAndInitialize();
            }, { once: true });
            
            // Fallback: se o vídeo não terminar em 60 segundos, continuar mesmo assim
            setTimeout(() => {
                if (splashScreen.style.display !== 'none' && splashScreen.style.display === 'flex') {
                    console.log('Timeout - vídeo não terminou, continuando mesmo assim');
                    hideSplashAndInitialize();
                }
            }, 60000);
        }
        
        // Aguardar um pequeno delay para garantir que o DOM está pronto
        setTimeout(() => {
            startVideoPlayback();
        }, 300);
        
    } else {
        console.log('Não mostrando splash screen - Condições não atendidas');
        // ESCONDER a splash screen imediatamente
        splashScreen.style.display = 'none';
        // Mostrar o container
        if (container) {
            container.style.display = '';
        }
        // Inicializar a aplicação imediatamente
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeApplication);
        } else {
            initializeApplication();
        }
    }
}

// Executar a verificação da splash screen IMEDIATAMENTE
// Esta função deve ser a primeira coisa a executar para bloquear o acesso
(function() {
    // Se o DOM ainda não está pronto, aguardar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(checkAndShowSplashScreen, 100);
        });
    } else {
        // DOM já carregado, executar imediatamente
        setTimeout(checkAndShowSplashScreen, 100);
    }
})();

// A inicialização da aplicação agora é controlada pela função checkAndShowSplashScreen
// que decide se mostra a splash screen ou inicializa diretamente através de initializeApplication()

// Inicializar aplicação
function initializeApp() {
    updateStats();
    updateCompanyHeader();
    applyButtonStyles();
}

// Configurar event listeners
function setupEventListeners() {
    // Navegação
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            showSection(section);
        });
    });

    // Cards movidos para outras seções - event listeners serão configurados dinamicamente
    setupCardEventListeners();

    // Formulário de cadastro de cliente
    document.getElementById('client-form').addEventListener('submit', handleClientSubmit);
    
    // Carregar todos os clientes na seção de clientes
    loadAllClients();
    
    // Inicializar visualização de clientes
    showClientsListView();

    // Formulário de perfil da empresa
    document.getElementById('company-form').addEventListener('submit', handleCompanySubmit);

    // Upload de logo
    document.getElementById('company-logo-input').addEventListener('change', handleLogoUpload);

    // Upload de imagem de fundo do cabeçalho da empresa
    const companyHeaderInput = document.getElementById('company-header-image-input');
    if (companyHeaderInput) {
        companyHeaderInput.addEventListener('change', handleCompanyHeaderImageUpload);
    }
    
    // Removido: Upload de imagem de suporte

    // Upload de imagem de fundo do tema
    const themeBackgroundInput = document.getElementById('theme-background-input');
    if (themeBackgroundInput) {
        themeBackgroundInput.addEventListener('change', handleThemeBackgroundUpload);
    }
    
    // Upload de foto do cliente
    document.getElementById('client-photo-input').addEventListener('change', handleClientPhotoUpload);
    document.getElementById('edit-client-photo-input').addEventListener('change', handleEditClientPhotoUpload);
    
    // Formulário de licença
    document.getElementById('license-form').addEventListener('submit', handleLicenseSubmit);

    // Modal de edição
    document.getElementById('edit-client-form').addEventListener('submit', handleEditClientSubmit);
    document.querySelector('.close').addEventListener('click', closeEditModal);
    document.getElementById('edit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'edit-modal') closeEditModal();
    });

    // Botão enviar felicitações
    document.getElementById('send-birthday-btn').addEventListener('click', openSelectClientModal);
    
    // Fechar modais ao clicar fora
    document.getElementById('select-client-modal').addEventListener('click', (e) => {
        if (e.target.id === 'select-client-modal') closeSelectClientModal();
    });
    document.getElementById('send-method-modal').addEventListener('click', (e) => {
        if (e.target.id === 'send-method-modal') closeSendMethodModal();
    });
    document.getElementById('email-action-modal').addEventListener('click', (e) => {
        if (e.target.id === 'email-action-modal') closeEmailActionModal();
    });
    
    // Formulário de usuário
    const userForm = document.getElementById('user-form');
    if (userForm) {
        userForm.addEventListener('submit', handleUserSubmit);
    }
    
    // Upload de foto do usuário
    const userPhotoInput = document.getElementById('user-photo-input');
    if (userPhotoInput) {
        userPhotoInput.addEventListener('change', handleUserPhotoUpload);
    }
    
    // Formulário de edição de usuário
    const editUserForm = document.getElementById('edit-user-form');
    if (editUserForm) {
        editUserForm.addEventListener('submit', handleEditUserSubmit);
    }
    
    // Upload de foto do usuário (edição)
    const editUserPhotoInput = document.getElementById('edit-user-photo-input');
    if (editUserPhotoInput) {
        editUserPhotoInput.addEventListener('change', handleEditUserPhotoUpload);
    }
    
    // Fechar modal de edição de usuário
    const editUserModal = document.getElementById('edit-user-modal');
    if (editUserModal) {
        editUserModal.addEventListener('click', (e) => {
            if (e.target.id === 'edit-user-modal') closeEditUserModal();
        });
    }
    
    // Fechar modal de seleção de usuários ao clicar fora
    const selectUserModal = document.getElementById('select-user-modal');
    if (selectUserModal) {
        selectUserModal.addEventListener('click', (e) => {
            if (e.target.id === 'select-user-modal') {
                closeSelectUserModal();
            }
        });
    }
    
    // Formulário de login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Toggle do Salvamento Automático
    const autoSaveToggle = document.getElementById('auto-save-toggle');
    if (autoSaveToggle) {
        autoSaveToggle.addEventListener('change', toggleAutoSave);
    }
    
    // Formulário de visibilidade de estoque
    const stockVisibilityForm = document.getElementById('stock-visibility-form');
    if (stockVisibilityForm) {
        stockVisibilityForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveStockVisibilitySettings();
        });
    }
    
    // Formulário de visibilidade de contas a receber
    const receivablesVisibilityForm = document.getElementById('receivables-visibility-form');
    if (receivablesVisibilityForm) {
        receivablesVisibilityForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveReceivablesVisibilitySettings();
        });
    }
    
    // Formulário de parcelamento
    const installmentForm = document.getElementById('installment-form');
    if (installmentForm) {
        installmentForm.addEventListener('submit', handleInstallmentSubmit);
    }
    
    // Fechar modal de parcelamento ao clicar fora
    const installmentModal = document.getElementById('installment-modal');
    if (installmentModal) {
        installmentModal.addEventListener('click', (e) => {
            if (e.target.id === 'installment-modal') {
                closeInstallmentModal();
            }
        });
    }
}

// Verificar se usuário é administrador
function isAdmin() {
    return currentUser && currentUser.accessLevel === 'admin';
}

// Verificar se usuário é funcionário
function isFuncionario() {
    return currentUser && currentUser.accessLevel === 'funcionario';
}

// Verificar permissão de acesso a uma seção
function hasAccessToSection(sectionId) {
    if (!currentUser) {
        return sectionId === 'support' || sectionId === 'home';
    }
    
    // Funcionários têm acesso limitado
    if (isFuncionario()) {
        const allowedSections = ['home', 'greetings', 'all-clients', 'support', 'inventory'];
        return allowedSections.includes(sectionId);
        return allowedSections.includes(sectionId);
    }
    
    // Administradores têm acesso a tudo
    return true;
}

// Mostrar seção
function showSection(sectionId) {
    // Verificar se usuário está logado (exceto para suporte)
    if (!currentUser && sectionId !== 'support' && sectionId !== 'home') {
        alert('⚠️ Acesso proibido! Por favor, realize o login para acessar esta funcionalidade.');
        // Redirecionar para home (que mostrará a tela de login)
        sectionId = 'home';
    }
    
    // Verificar permissões usando o sistema de permissões do usuário
    if (currentUser && !hasUserPermission(sectionId)) {
        alert('⚠️ Acesso negado! Você não tem permissão para acessar esta funcionalidade.');
        return;
    }
    
    // Verificar se licença está expirada
    // Permitir acesso à tela de início mesmo quando expirada
    if (isLicenseExpired() && sectionId !== 'license' && sectionId !== 'support' && sectionId !== 'home') {
        // Redirecionar para tela de adquirir licença
        sectionId = 'license';
    }
    
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active');
    const navBtn = document.querySelector(`[data-section="${sectionId}"]`);
    if (navBtn) {
        navBtn.classList.add('active');
    }
    
    // Recarregar listas quando mudar de seção
    if (sectionId === 'all-clients') {
        showClientsListView(); // Sempre mostrar lista ao entrar na seção
        loadAllClients();
        updateStats(); // Atualizar card de clientes cadastrados
        setupCardEventListeners(); // Reconfigurar event listeners
    } else if (sectionId === 'greetings') {
        loadClients();
        updateStats(); // Atualizar card de aniversários e painel
        setupCardEventListeners(); // Reconfigurar event listeners
    } else if (sectionId === 'license-status') {
        updateLicenseStatus();
    } else if (sectionId === 'license') {
        updateLicenseExpirationMessage();
    } else if (sectionId === 'home') {
        updateLicenseExpirationMessage();
        loadCriticalStockAlert(); // Carregar alerta de estoque crítico
        loadReceivablesExpirationAlert(); // Carregar alerta de vencimento de contas a receber
    } else if (sectionId === 'support') {
        updateSupportImage();
    } else if (sectionId === 'users') {
        showUsersListView();
    } else if (sectionId === 'settings') {
        // Configurar o seletor de cor quando a seção de configurações for aberta
        setupThemeColorPicker();
        loadUsers();
    } else if (sectionId === 'system-log') {
        loadSystemLogs();
        loadUsersForLogFilter();
    } else if (sectionId === 'more-options') {
        updateMoreOptionsVisibility();
    } else if (sectionId === 'backup') {
        // Configurar o toggle switch se ainda não estiver configurado
        const autoSaveToggle = document.getElementById('auto-save-toggle');
        if (autoSaveToggle && !autoSaveToggle.hasAttribute('data-listener-setup')) {
            autoSaveToggle.setAttribute('data-listener-setup', 'true');
            autoSaveToggle.addEventListener('change', toggleAutoSave);
        }
        updateAutoSaveStatus(); // Atualizar status do auto-save quando abrir a seção
    } else if (sectionId === 'birthday-card-settings') {
        loadBirthdayCardSettingsIntoForm();
    } else if (sectionId === 'button-settings') {
        loadButtonSettingsForm();
    } else if (sectionId === 'inactivity-timeout') {
        loadInactivityTimeoutSettings();
    } else if (sectionId === 'company') {
        loadCompanyData();
        updateCompanyHeader();
    } else if (sectionId === 'inventory') {
        showInventoryView('products');
        loadProducts();
        updateInventoryProductsCount(); // Atualizar contador no botão
        updateInventorySuppliersCount(); // Atualizar contador no botão
        updateInventoryClientsCount(); // Atualizar contador no botão
    } else if (sectionId === 'sales') {
        initializeSalesScreen();
        // Maximizar tela ao abrir vendas
        maximizeSalesScreen();
        // Garantir foco no campo Código Barras
        setTimeout(() => {
            const barcodeField = document.getElementById('sale-barcode');
            if (barcodeField) {
                barcodeField.focus();
                barcodeField.select();
            }
        }, 200);
    }
    
    // Atualizar visibilidade dos menus de "Mais Opções" sempre que mudar de seção
    updateMoreOptionsVisibility();
}

// Atualizar visibilidade dos cards de "Mais Opções" baseado nas permissões do usuário
function updateMoreOptionsVisibility() {
    const moreOptionsGrid = document.querySelector('.more-options-grid');
    if (!moreOptionsGrid || !currentUser) return;
    
    const optionCards = moreOptionsGrid.querySelectorAll('.option-card');
    optionCards.forEach(card => {
        const onclickAttr = card.getAttribute('onclick');
        if (!onclickAttr) return;
        
        // Extrair o sectionId do onclick
        const match = onclickAttr.match(/showSection\('([^']+)'\)/);
        if (!match) return;
        
        const sectionId = match[1];
        
        // Verificar permissão usando hasUserPermission
        if (hasUserPermission(sectionId)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Atualizar visibilidade dos botões do menu de Controle de Estoque baseado nas permissões
function updateInventoryMenuVisibility() {
    const inventoryMenu = document.querySelector('.inventory-menu');
    if (!inventoryMenu || !currentUser) return;
    
    const inventoryButtons = inventoryMenu.querySelectorAll('.inventory-option-btn');
    inventoryButtons.forEach(button => {
        const onclickAttr = button.getAttribute('onclick');
        if (!onclickAttr) return;
        
        // Extrair o viewId do onclick
        const match = onclickAttr.match(/showInventoryView\('([^']+)'\)/);
        if (!match) return;
        
        const viewId = match[1];
        
        // Mapear viewId para sectionId para verificar permissão
        const viewToSectionMap = {
            'clients': 'clients',
            'products': 'products',
            'brands': 'brands',
            'categories': 'categories',
            'suppliers': 'suppliers',
            'entries': 'entries',
            'exits': 'exits',
            'receivables': 'receivables',
            'reports': 'reports',
            'settings': 'inventory-settings'
        };
        
        const sectionId = viewToSectionMap[viewId];
        if (sectionId === 'receivables') {
            // Para Contas a Receber, verificar permissão de visualizar
            if (!hasReceivablesPermission('visualizar')) {
                button.style.display = 'none';
            } else {
                button.style.display = 'block';
            }
        } else if (sectionId && !hasUserPermission(sectionId)) {
            button.style.display = 'none';
        } else {
            button.style.display = 'block';
        }
    });
}

// Atualizar visibilidade dos botões de navegação baseado nas permissões
function updateNavigationVisibility() {
    if (!currentUser) return;
    
    // Botão Vender
    const salesBtn = document.querySelector('.nav-btn[data-section="sales"]');
    if (salesBtn) {
        if (hasUserPermission('sales')) {
            salesBtn.style.display = 'block';
        } else {
            salesBtn.style.display = 'none';
        }
    }
    
    // Botão Controle de Estoque
    const inventoryBtn = document.querySelector('.nav-btn[data-section="inventory"]');
    if (inventoryBtn) {
        if (hasUserPermission('inventory')) {
            inventoryBtn.style.display = 'block';
        } else {
            inventoryBtn.style.display = 'none';
        }
    }
    
    // Botão Mais Opções
    const moreOptionsBtn = document.querySelector('.nav-btn[data-section="more-options"]');
    if (moreOptionsBtn) {
        if (hasUserPermission('more-options')) {
            moreOptionsBtn.style.display = 'block';
        } else {
            moreOptionsBtn.style.display = 'none';
        }
    }
}

// Controlar visibilidade dos menus de navegação e botões de sessão
function updateMenuVisibility() {
    const navMenu = document.querySelector('.nav-menu');
    const userInfoHeader = document.getElementById('user-info-header');
    
    // Se não há usuário logado (logout total) -> esconder tudo
    if (!currentUser) {
        if (navMenu) navMenu.style.display = 'none';
        if (userInfoHeader) userInfoHeader.style.display = 'none';
        return;
    }
    
    // Se está em modo de troca (pedindo senha) -> esconder TUDO (menus e botões de sessão)
    if (selectedUserForSwitch) {
        if (navMenu) navMenu.style.display = 'none';
        if (userInfoHeader) userInfoHeader.style.display = 'none';
        return;
    }
    
    // Se está logado normalmente -> mostrar tudo
    if (navMenu) navMenu.style.display = 'flex';
    if (userInfoHeader) userInfoHeader.style.display = 'flex';
}

// Adicionar campo dinâmico (telefone ou email)
function addField(type) {
    const container = type === 'phone' ? 
        document.getElementById('phones-container') : 
        document.getElementById('emails-container');
    
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'dynamic-field';
    
    const input = document.createElement('input');
    input.type = type === 'phone' ? 'tel' : 'email';
    input.className = type === 'phone' ? 'phone-input' : 'email-input';
    input.placeholder = type === 'phone' ? '(00) 00000-0000' : 'email@exemplo.com';
    input.required = true;
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remover';
    removeBtn.onclick = () => removeField(removeBtn, type);
    
    fieldDiv.appendChild(input);
    fieldDiv.appendChild(removeBtn);
    container.appendChild(fieldDiv);
}

// Remover campo dinâmico
function removeField(button, type) {
    const container = type === 'phone' ? 
        document.getElementById('phones-container') : 
        document.getElementById('emails-container');
    
    if (container.children.length > 1) {
        button.parentElement.remove();
    } else {
        alert('É necessário ter pelo menos um ' + (type === 'phone' ? 'telefone' : 'email'));
    }
}

// Adicionar campo dinâmico no modal de edição
function addEditField(type) {
    const container = type === 'phone' ? 
        document.getElementById('edit-phones-container') : 
        document.getElementById('edit-emails-container');
    
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'dynamic-field';
    
    const input = document.createElement('input');
    input.type = type === 'phone' ? 'tel' : 'email';
    input.className = type === 'phone' ? 'phone-input' : 'email-input';
    input.placeholder = type === 'phone' ? '(00) 00000-0000' : 'email@exemplo.com';
    input.required = true;
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remover';
    removeBtn.onclick = () => {
        if (container.children.length > 1) {
            removeBtn.parentElement.remove();
        } else {
            alert('É necessário ter pelo menos um ' + (type === 'phone' ? 'telefone' : 'email'));
        }
    };
    
    fieldDiv.appendChild(input);
    fieldDiv.appendChild(removeBtn);
    container.appendChild(fieldDiv);
}

// Manipular submit do formulário de cliente
function handleClientSubmit(e) {
    e.preventDefault();
    
    // Verificar permissão - funcionários não podem cadastrar clientes
    if (!isAdmin()) {
        alert('⚠️ Acesso negado! Apenas administradores podem cadastrar clientes.');
        return;
    }
    
    const name = document.getElementById('client-name').value.trim();
    const cpf = document.getElementById('client-cpf').value.trim();
    let birthdate = document.getElementById('client-birthdate').value;
    
    // Garantir que a data está no formato correto YYYY-MM-DD
    // Se vier com timezone, remover
    if (birthdate.includes('T')) {
        birthdate = birthdate.split('T')[0];
    }
    
    const phones = Array.from(document.querySelectorAll('.phone-input'))
        .map(input => input.value.trim())
        .filter(phone => phone);
    
    const emails = Array.from(document.querySelectorAll('.email-input'))
        .map(input => input.value.trim())
        .filter(email => email);
    
    if (!name || !birthdate || phones.length === 0 || emails.length === 0) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    const client = {
        id: Date.now().toString(),
        name,
        cpf,
        birthdate,
        phones,
        emails,
        photo: '',
        createdAt: new Date().toISOString()
    };
    
    // Usar foto recortada se disponível, senão usar foto do preview
    if (window._pendingClientPhoto) {
        client.photo = window._pendingClientPhoto;
        window._pendingClientPhoto = null;
    } else {
        const preview = document.getElementById('client-photo-preview');
        if (preview && preview.src && preview.style.display !== 'none') {
            client.photo = preview.src;
        }
    }
    saveClientFinal(client);
}

function saveClientFinal(client) {
    clients.push(client);
    saveClients();
    addSystemLog('create_client', `Cliente "${client.name}" foi cadastrado`, currentUser ? currentUser.username : 'Sistema');
    loadAllClients();
    loadClients();
    updateStats();
    
    // Limpar formulário
    document.getElementById('client-form').reset();
    document.getElementById('client-photo-preview').style.display = 'none';
    document.getElementById('phones-container').innerHTML = `
        <div class="dynamic-field">
            <input type="tel" class="phone-input" placeholder="(00) 00000-0000" required>
            <button type="button" class="btn-remove" onclick="removeField(this, 'phone')">Remover</button>
        </div>
    `;
    document.getElementById('emails-container').innerHTML = `
        <div class="dynamic-field">
            <input type="email" class="email-input" placeholder="email@exemplo.com" required>
            <button type="button" class="btn-remove" onclick="removeField(this, 'email')">Remover</button>
        </div>
    `;
    
    alert('Cliente cadastrado com sucesso!');
    showClientsListView();
}

// Obter status do aniversário do cliente
function getBirthdayStatus(client) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const birthDate = new Date(client.birthdate);
    const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    
    // Calcular aniversário deste ano
    let birthdayThisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    
    // Se o aniversário já passou este ano, calcular dias desde o aniversário
    if (birthdayThisYear < today) {
        const daysSince = Math.floor((today - birthdayThisYear) / (1000 * 60 * 60 * 24));
        if (daysSince <= 7) {
            return 'past'; // Dentro de uma semana passada
        }
        // Se passou mais de 7 dias, não mostrar
        return null;
    }
    
    const daysDiff = Math.floor((birthdayThisYear - today) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
        return 'today'; // Aniversário hoje
    } else if (daysDiff > 0 && daysDiff <= 365) {
        return 'upcoming'; // Ainda vai fazer aniversário este ano
    }
    
    return null; // Não está no período válido
}

// Verificar se já foi enviado felicitações dentro de uma semana
function wasGreetingSent(client) {
    if (!sentGreetings[client.id]) return false;
    
    const sentDate = new Date(sentGreetings[client.id]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((today - sentDate) / (1000 * 60 * 60 * 24));
    return daysDiff <= 7;
}

// Filtrar clientes que devem aparecer na lista
function getFilteredClients() {
    return clients.filter(client => {
        const status = getBirthdayStatus(client);
        if (!status) return false; // Não está no período válido
        
        // Mostrar todos que estão no período válido (incluindo os que já receberam)
        // A diferença será mostrada visualmente no card
        return status === 'today' || status === 'past' || status === 'upcoming';
    });
}

// Helpers para remoção temporária de clientes na tela de felicitações
function getCurrentYearKey() {
    return new Date().getFullYear().toString();
}

function cleanRemovedGreetingClientsHistory() {
    const currentYear = getCurrentYearKey();
    let changed = false;
    Object.keys(removedGreetingClients).forEach(year => {
        if (year !== currentYear) {
            delete removedGreetingClients[year];
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem('removedGreetingClients', JSON.stringify(removedGreetingClients));
    }
}

function isClientRemovedFromGreetings(clientId) {
    const yearKey = getCurrentYearKey();
    return removedGreetingClients[yearKey] && removedGreetingClients[yearKey][clientId];
}

function removeClientFromGreetings(clientId, event = null) {
    if (event) event.stopPropagation();
    if (!confirm('Deseja remover este cliente da tela de felicitações (apenas para o ano atual)?')) {
        return;
    }
    const yearKey = getCurrentYearKey();
    if (!removedGreetingClients[yearKey]) {
        removedGreetingClients[yearKey] = {};
    }
    removedGreetingClients[yearKey][clientId] = true;
    localStorage.setItem('removedGreetingClients', JSON.stringify(removedGreetingClients));
    
    const client = clients.find(c => c.id === clientId);
    if (client) {
        addSystemLog('remove_greeting_client', `Cliente "${client.name}" foi removido da tela de felicitações (${yearKey}).`, currentUser ? currentUser.username : 'Sistema');
    }
    loadClients();
}

// Carregar clientes (para Felicitações - com filtros e seleção)
function loadClients() {
    const container = document.getElementById('clients-list');
    const filteredClients = getFilteredClients().filter(client => !isClientRemovedFromGreetings(client.id));
    
    if (filteredClients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum cliente para enviar felicitações</h3>
                <p>Não há clientes fazendo aniversário hoje ou nos próximos dias, ou as felicitações já foram enviadas.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredClients.map(client => {
        const status = getBirthdayStatus(client);
        let indicatorClass = '';
        let indicatorTitle = '';
        
        if (status === 'today') {
            indicatorClass = 'today';
            indicatorTitle = 'Aniversário hoje';
        } else if (status === 'past') {
            indicatorClass = 'past';
            indicatorTitle = 'Aniversário recente (última semana)';
        } else if (status === 'upcoming') {
            indicatorClass = 'upcoming';
            indicatorTitle = 'Aniversário próximo';
        }
        
        const phonesHtml = client.phones.map(phone => `<div>📞 ${phone}</div>`).join('');
        const emailsHtml = client.emails.map(email => `<div>✉️ ${email}</div>`).join('');
        const wasSent = wasGreetingSent(client);
        const photoHtml = client.photo ? `<img src="${client.photo}" alt="${client.name}" class="client-photo">` : '<div class="client-photo" style="background: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 24px;">👤</div>';
        const cardClass = getCardBirthdayClass(client);
        
        return `
            <div class="client-card ${cardClass}" onclick="selectClientForGreeting('${client.id}')">
                <div class="client-card-header">
                    ${photoHtml}
                    <h3>
                        ${client.name}
                        ${indicatorClass ? `<span class="birthday-indicator ${indicatorClass}" title="${indicatorTitle}"></span>` : ''}
                        ${wasSent ? '<span class="greeting-sent-badge">✓ Mensagem Enviada</span>' : ''}
                    </h3>
                </div>
                ${client.cpf ? `<div class="client-info"><strong>CPF:</strong> ${client.cpf}</div>` : ''}
                <div class="client-info"><strong>Data de Nascimento:</strong> ${formatDate(client.birthdate)}</div>
                ${getBirthdayDaysIndicator(client)}
                <div class="client-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-remove" onclick="removeClientFromGreetings('${client.id}', event)">Remover</button>
                </div>
            </div>
        `;
    }).join('');
}

// Carregar todos os clientes (sem filtros, sem seleção)
function loadAllClients() {
    const container = document.getElementById('all-clients-list');
    
    if (clients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum cliente cadastrado</h3>
                <p>Comece cadastrando seu primeiro cliente!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = clients.map(client => {
        const phonesHtml = client.phones.map(phone => `<div>📞 ${phone}</div>`).join('');
        const emailsHtml = client.emails.map(email => `<div>✉️ ${email}</div>`).join('');
        const photoHtml = client.photo ? `<img src="${client.photo}" alt="${client.name}" class="client-photo">` : '<div class="client-photo" style="background: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 24px;">👤</div>';
        const cardClass = getCardBirthdayClass(client);
        
        return `
            <div class="client-card ${cardClass}" onclick="editClientFromCard('${client.id}')" style="cursor: pointer;">
                <div class="client-card-header">
                    ${photoHtml}
                    <h3>${client.name}</h3>
                </div>
                ${client.cpf ? `<div class="client-info"><strong>CPF:</strong> ${client.cpf}</div>` : ''}
                <div class="client-info"><strong>Data de Nascimento:</strong> ${formatDate(client.birthdate)}</div>
                ${getBirthdayDaysIndicator(client)}
                <div class="client-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-edit" onclick="editClientFromCard('${client.id}')">✏️ Editar</button>
                    <button class="btn btn-delete" onclick="deleteClientFromCard('${client.id}')">🗑️ Excluir</button>
                </div>
            </div>
        `;
    }).join('');
}

// Abrir modal de edição
function openEditModal(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    document.getElementById('edit-client-id').value = client.id;
    document.getElementById('edit-client-name').value = client.name;
    document.getElementById('edit-client-cpf').value = client.cpf || '';
    
    // Usar a data exatamente como está salva (formato YYYY-MM-DD)
    // Garantir que está no formato correto, removendo qualquer parte de hora se existir
    let birthdateValue = client.birthdate;
    if (birthdateValue && birthdateValue.includes('T')) {
        birthdateValue = birthdateValue.split('T')[0];
    }
    document.getElementById('edit-client-birthdate').value = birthdateValue;
    
    // Mostrar foto atual se existir
    const photoPreview = document.getElementById('edit-client-photo-preview');
    if (client.photo) {
        photoPreview.src = client.photo;
        photoPreview.style.display = 'block';
    } else {
        photoPreview.style.display = 'none';
    }
    
    // Preencher telefones
    const phonesContainer = document.getElementById('edit-phones-container');
    phonesContainer.innerHTML = client.phones.map(phone => `
        <div class="dynamic-field">
            <input type="tel" class="phone-input" placeholder="(00) 00000-0000" value="${phone}" required>
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remover</button>
        </div>
    `).join('');
    
    // Preencher emails
    const emailsContainer = document.getElementById('edit-emails-container');
    emailsContainer.innerHTML = client.emails.map(email => `
        <div class="dynamic-field">
            <input type="email" class="email-input" placeholder="email@exemplo.com" value="${email}" required>
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remover</button>
        </div>
    `).join('');
    
    document.getElementById('edit-modal').style.display = 'block';
}

// Fechar modal de edição
function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

// Manipular submit do formulário de edição
function handleEditClientSubmit(e) {
    e.preventDefault();
    
    const clientId = document.getElementById('edit-client-id').value;
    const clientIndex = clients.findIndex(c => c.id === clientId);
    
    if (clientIndex === -1) return;
    
    const name = document.getElementById('edit-client-name').value.trim();
    const cpf = document.getElementById('edit-client-cpf').value.trim();
    let birthdate = document.getElementById('edit-client-birthdate').value;
    
    // Garantir que a data está no formato correto YYYY-MM-DD
    // Se vier com timezone, remover
    if (birthdate.includes('T')) {
        birthdate = birthdate.split('T')[0];
    }
    
    const phones = Array.from(document.querySelectorAll('#edit-phones-container .phone-input'))
        .map(input => input.value.trim())
        .filter(phone => phone);
    
    const emails = Array.from(document.querySelectorAll('#edit-emails-container .email-input'))
        .map(input => input.value.trim())
        .filter(email => email);
    
    if (!name || !birthdate || phones.length === 0 || emails.length === 0) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    // Usar foto recortada se disponível, senão manter foto atual ou usar preview
    let photo = clients[clientIndex].photo || '';
    if (window._pendingEditClientPhoto) {
        photo = window._pendingEditClientPhoto;
        window._pendingEditClientPhoto = null;
    } else {
        const preview = document.getElementById('edit-client-photo-preview');
        if (preview && preview.src && preview.style.display !== 'none' && preview.src !== photo) {
            photo = preview.src;
        }
    }
    updateClientFinal(clientIndex, name, cpf, birthdate, phones, emails, photo);
}

function updateClientFinal(clientIndex, name, cpf, birthdate, phones, emails, photo) {
    clients[clientIndex] = {
        ...clients[clientIndex],
        name,
        cpf,
        birthdate,
        phones,
        emails,
        photo
    };
    
    saveClients();
    autoSave(); // Salvamento automático
    addSystemLog('edit_client', `Cliente "${name}" foi editado`, currentUser ? currentUser.username : 'Sistema');
    loadClients();
    loadAllClients();
    updateStats();
    closeEditModal();
    
    alert('Cliente atualizado com sucesso!');
}

// Deletar cliente
function deleteClient(clientId) {
    // Verificar permissão
    if (!isAdmin()) {
        alert('⚠️ Acesso negado! Apenas administradores podem excluir clientes.');
        return;
    }
    
    const client = clients.find(c => c.id === clientId);
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
        clients = clients.filter(c => c.id !== clientId);
        // Remover também do histórico de felicitações
        delete sentGreetings[clientId];
        localStorage.setItem('sentGreetings', JSON.stringify(sentGreetings));
        saveClients();
        if (client) {
            addSystemLog('delete_client', `Cliente "${client.name}" foi excluído`, currentUser ? currentUser.username : 'Sistema');
        }
        loadClients(); // Recarregar lista de felicitações
        loadAllClients(); // Recarregar lista de todos os clientes
        loadInventoryClients(); // Recarregar lista do inventário
        updateInventoryClientsCount(); // Atualizar contador no botão
        autoSave(); // Salvamento automático
        updateStats();
        alert('Cliente excluído com sucesso!');
    }
}

// Salvar clientes
function saveClients() {
    localStorage.setItem('clients', JSON.stringify(clients));
}

// Carregar dados da empresa
function loadCompanyData() {
    document.getElementById('company-name-input').value = companyData.name || '';
    document.getElementById('owner-name').value = companyData.ownerName || '';
    document.getElementById('owner-contact').value = companyData.ownerContact || '';
    document.getElementById('owner-email').value = companyData.ownerEmail || '';
    document.getElementById('owner-birthdate').value = companyData.ownerBirthdate || '';
    document.getElementById('company-address').value = companyData.address || '';
    document.getElementById('company-description').value = companyData.description || '';
    
    if (companyData.logo) {
        // Detectar tipo automaticamente se não estiver definido (para compatibilidade com dados antigos)
        let logoType = companyData.logoType;
        if (!logoType) {
            // Se começar com data:video, é vídeo; se começar com data:image, é imagem
            if (companyData.logo.startsWith('data:video/')) {
                logoType = 'video';
                companyData.logoType = 'video';
            } else {
                logoType = 'image';
                companyData.logoType = 'image';
            }
        }
        
        const logoImg = document.getElementById('company-logo');
        const logoVideo = document.getElementById('company-logo-video');
        const previewImg = document.getElementById('logo-preview');
        const previewVideo = document.getElementById('logo-preview-video');
        
        if (logoType === 'video') {
            // Mostrar vídeo
            if (logoVideo) {
                logoVideo.src = companyData.logo;
                logoVideo.style.display = 'block';
            }
            if (logoImg) {
                logoImg.style.display = 'none';
            }
            if (previewVideo) {
                previewVideo.src = companyData.logo;
                previewVideo.style.display = 'block';
            }
            if (previewImg) {
                previewImg.style.display = 'none';
            }
        } else {
            // Mostrar imagem
            if (logoImg) {
                logoImg.src = companyData.logo;
                logoImg.style.display = 'block';
            }
            if (logoVideo) {
                logoVideo.style.display = 'none';
            }
            if (previewImg) {
                previewImg.src = companyData.logo;
                previewImg.style.display = 'block';
            }
            if (previewVideo) {
                previewVideo.style.display = 'none';
            }
        }
    }
    
    // Carregar imagem de suporte (imagem fixa do projeto)
    const supportImagePreview = document.getElementById('support-image-preview');
    const supportImage = document.getElementById('support-image');
    const supportImageMarcio = document.getElementById('support-image-marcio');
    
    // Sempre garantir que a imagem de suporte esteja visível
    if (supportImage) {
        supportImage.style.display = 'block';
        supportImage.style.visibility = 'visible';
        supportImage.style.opacity = '1';
        // Usar imagem fixa do projeto
        supportImage.src = 'images/support-photo.jpg';
    }
    
    // Carregar imagem do Marcio
    if (supportImageMarcio) {
        supportImageMarcio.style.display = 'block';
        supportImageMarcio.style.visibility = 'visible';
        supportImageMarcio.style.opacity = '1';
        supportImageMarcio.src = 'images/marcio.jpg';
    }
    
    // Preview ainda pode usar imagem do localStorage se existir
    if (supportImagePreview && companyData.supportImage && companyData.supportImage.trim() !== '') {
        supportImagePreview.src = companyData.supportImage;
        supportImagePreview.style.display = 'block';
    }
    
    // Carregar preview da imagem de fundo do cabeçalho
    const headerPreview = document.getElementById('company-header-preview');
    if (headerPreview && companyData.headerImage && companyData.headerImage.trim() !== '') {
        headerPreview.style.backgroundImage = `url('${companyData.headerImage}')`;
        headerPreview.style.backgroundSize = 'contain';
        headerPreview.style.backgroundRepeat = 'repeat';
        headerPreview.style.backgroundPosition = 'center';
        headerPreview.innerHTML = '';
        const removeHeaderBtn = document.getElementById('remove-header-bg-btn');
        if (removeHeaderBtn) removeHeaderBtn.style.display = 'inline-block';
    } else if (headerPreview) {
        headerPreview.style.backgroundImage = 'none';
        headerPreview.innerHTML = '<span>Pré-visualização da imagem de fundo do cabeçalho.</span>';
        const removeHeaderBtn = document.getElementById('remove-header-bg-btn');
        if (removeHeaderBtn) removeHeaderBtn.style.display = 'none';
    }
    
    // Mostrar/ocultar botão de remover logo
    const removeLogoBtn = document.getElementById('remove-logo-btn');
    if (removeLogoBtn) {
        removeLogoBtn.style.display = (companyData.logo && companyData.logo.trim() !== '') ? 'inline-block' : 'none';
    }
}

// Atualizar header da empresa
function updateCompanyHeader() {
    document.getElementById('company-name').textContent = companyData.name || 'Nome da Empresa';
    
    if (companyData.logo) {
        // Detectar tipo automaticamente se não estiver definido
        let logoType = companyData.logoType;
        if (!logoType) {
            if (companyData.logo.startsWith('data:video/')) {
                logoType = 'video';
                companyData.logoType = 'video';
            } else {
                logoType = 'image';
                companyData.logoType = 'image';
            }
        }
        
        const logoImg = document.getElementById('company-logo');
        const logoVideo = document.getElementById('company-logo-video');
        
        if (logoType === 'video') {
            // Mostrar vídeo
            if (logoVideo) {
                logoVideo.src = companyData.logo;
                logoVideo.style.display = 'block';
            }
            if (logoImg) {
                logoImg.style.display = 'none';
            }
        } else {
            // Mostrar imagem
            if (logoImg) {
                logoImg.src = companyData.logo;
                logoImg.style.display = 'block';
            }
            if (logoVideo) {
                logoVideo.style.display = 'none';
            }
        }
    } else {
        // Esconder ambos se não houver logo
        const logoImg = document.getElementById('company-logo');
        const logoVideo = document.getElementById('company-logo-video');
        if (logoImg) logoImg.style.display = 'none';
        if (logoVideo) logoVideo.style.display = 'none';
    }

    // Aplicar imagem de fundo do cabeçalho da empresa, se existir
    if (companyData.headerImage && companyData.headerImage.trim() !== '') {
        document.documentElement.style.setProperty('--company-header-image', `url('${companyData.headerImage}')`);
    } else {
        document.documentElement.style.setProperty('--company-header-image', 'none');
    }
    
    // Carregar preview da imagem de fundo do cabeçalho no formulário
    const headerPreview = document.getElementById('company-header-preview');
    if (headerPreview && companyData.headerImage && companyData.headerImage.trim() !== '') {
        headerPreview.style.backgroundImage = `url('${companyData.headerImage}')`;
        headerPreview.style.backgroundSize = 'contain';
        headerPreview.style.backgroundRepeat = 'repeat';
        headerPreview.style.backgroundPosition = 'center';
        headerPreview.innerHTML = '';
    } else if (headerPreview) {
        headerPreview.style.backgroundImage = 'none';
        headerPreview.innerHTML = '<span>Pré-visualização da imagem de fundo do cabeçalho.</span>';
    }
}

// Atualizar imagem de suporte (imagem fixa do projeto)
function updateSupportImage() {
    const supportImage = document.getElementById('support-image');
    const supportImageMarcio = document.getElementById('support-image-marcio');
    
    // Atualizar primeira imagem de suporte
    if (supportImage) {
        // SEMPRE forçar visibilidade da imagem (fixa)
        supportImage.style.display = 'block';
        supportImage.style.visibility = 'visible';
        supportImage.style.opacity = '1';
        
        // Usar imagem fixa do projeto (images/support-photo.jpg)
        const fixedImagePath = 'images/support-photo.jpg';
        supportImage.src = fixedImagePath;
        
        // Verificar se a imagem carregou com sucesso
        supportImage.onload = function() {
            console.log('Imagem de suporte fixa carregada com sucesso');
            supportImage.style.display = 'block';
            supportImage.style.visibility = 'visible';
            supportImage.style.opacity = '1';
        };
        
        supportImage.onerror = function() {
            console.log('Imagem fixa não encontrada, tentando usar imagem do localStorage...');
            // Fallback: tentar usar imagem do localStorage se existir
            try {
                const savedCompanyData = JSON.parse(localStorage.getItem('companyData')) || {};
                if (savedCompanyData.supportImage && savedCompanyData.supportImage.trim() !== '') {
                    supportImage.src = savedCompanyData.supportImage;
                    companyData.supportImage = savedCompanyData.supportImage;
                } else {
                    // Se não houver imagem, manter visível mas sem src
                    supportImage.style.display = 'block';
                    supportImage.style.visibility = 'visible';
                    supportImage.style.opacity = '0.3';
                    console.log('Nenhuma imagem encontrada. Por favor, copie a imagem para a pasta images/ como support-photo.jpg');
                }
            } catch (error) {
                console.error('Erro ao carregar imagem de suporte:', error);
                supportImage.style.display = 'block';
                supportImage.style.visibility = 'visible';
            }
        };
    }
    
    // Atualizar imagem do Marcio
    if (supportImageMarcio) {
        supportImageMarcio.style.display = 'block';
        supportImageMarcio.style.visibility = 'visible';
        supportImageMarcio.style.opacity = '1';
        supportImageMarcio.src = 'images/marcio.jpg';
        
        supportImageMarcio.onload = function() {
            console.log('Imagem do Marcio carregada com sucesso');
        };
        
        supportImageMarcio.onerror = function() {
            console.log('Imagem do Marcio não encontrada');
            supportImageMarcio.style.display = 'block';
            supportImageMarcio.style.visibility = 'visible';
            supportImageMarcio.style.opacity = '0.3';
        };
    }
}

// Manipular upload de logo
function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Verificar se é vídeo ou imagem
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    
    // Validar formato
    if (!isVideo && !isImage) {
        alert('Formato inválido. Selecione uma imagem (JPG, PNG) ou vídeo (WEBM, MP4).');
        e.target.value = '';
        return;
    }
    
    // Validar tipos específicos
    if (isVideo) {
        if (file.type !== 'video/webm' && file.type !== 'video/mp4') {
            alert('Formato de vídeo inválido. Selecione WEBM ou MP4.');
            e.target.value = '';
            return;
        }
    } else if (isImage) {
        if (file.type !== 'image/jpeg' && file.type !== 'image/jpg' && file.type !== 'image/png') {
            alert('Formato de imagem inválido. Selecione JPG ou PNG.');
            e.target.value = '';
            return;
        }
    }
    
    // Validar tamanho (10MB para vídeos, 5MB para imagens)
    const maxSize = isVideo ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
        alert(`Arquivo muito grande. Tamanho máximo: ${isVideo ? '10MB' : '5MB'}.`);
        e.target.value = '';
        return;
    }
    
    if (isVideo) {
        // Para vídeo, converter para base64 sem cropping
        const reader = new FileReader();
        reader.onload = function(event) {
            const videoData = event.target.result;
            companyData.logo = videoData;
            companyData.logoType = 'video'; // Marcar como vídeo
            
            // Esconder imagem e mostrar vídeo
            const logoImg = document.getElementById('company-logo');
            const logoVideo = document.getElementById('company-logo-video');
            const previewImg = document.getElementById('logo-preview');
            const previewVideo = document.getElementById('logo-preview-video');
            
            if (logoImg) {
                logoImg.style.display = 'none';
                logoImg.src = '';
            }
            if (logoVideo) {
                logoVideo.src = videoData;
                logoVideo.style.display = 'block';
            }
            if (previewImg) {
                previewImg.style.display = 'none';
                previewImg.src = '';
            }
            if (previewVideo) {
                previewVideo.src = videoData;
                previewVideo.style.display = 'block';
            }
            
            document.getElementById('remove-logo-btn').style.display = 'inline-block';
            saveCompanyData();
            updateCompanyHeader();
            alert('Vídeo atualizado com sucesso!');
        };
        reader.onerror = function() {
            alert('Erro ao carregar o vídeo. Por favor, tente novamente.');
            e.target.value = '';
        };
        reader.readAsDataURL(file);
    } else {
        // Para imagem, usar cropping como antes
        openCropModal(file, 'logo', 1, (croppedImageData) => {
            companyData.logo = croppedImageData;
            companyData.logoType = 'image'; // Marcar como imagem
            
            // Esconder vídeo e mostrar imagem
            const logoImg = document.getElementById('company-logo');
            const logoVideo = document.getElementById('company-logo-video');
            const previewImg = document.getElementById('logo-preview');
            const previewVideo = document.getElementById('logo-preview-video');
            
            if (logoVideo) {
                logoVideo.style.display = 'none';
                logoVideo.src = '';
            }
            if (logoImg) {
                logoImg.src = croppedImageData;
                logoImg.style.display = 'block';
            }
            if (previewVideo) {
                previewVideo.style.display = 'none';
                previewVideo.src = '';
            }
            if (previewImg) {
                previewImg.src = croppedImageData;
                previewImg.style.display = 'block';
            }
            
            document.getElementById('remove-logo-btn').style.display = 'inline-block';
            saveCompanyData();
            updateCompanyHeader();
            alert('Logo atualizado com sucesso!');
        });
    }
}

// Variáveis globais para cropping
let currentCropper = null;
let currentCropType = null;
let currentCropCallback = null;

// Abrir modal de cropping
function openCropModal(file, cropType, aspectRatio, callback) {
    if (!file) return;
    
    // Validar formato
    if (!(file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png')) {
        alert('Formato inválido. Selecione uma imagem JPG ou PNG.');
        return;
    }
    
    currentCropType = cropType;
    currentCropCallback = callback;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const imageSrc = event.target.result;
        const cropImage = document.getElementById('crop-image');
        const cropModal = document.getElementById('image-crop-modal');
        const cropTitle = document.getElementById('crop-modal-title');
        
        // Definir título do modal
        const titles = {
            'logo': 'Ajustar Logo da Empresa',
            'header-bg': 'Ajustar Fundo do Cabeçalho',
            'client-photo': 'Ajustar Foto do Cliente',
            'user-photo': 'Ajustar Foto do Usuário',
            'theme-bg': 'Ajustar Fundo do Tema',
            'product-photo': 'Ajustar Imagem do Produto',
            'supplier-logo': 'Ajustar Logo do Fornecedor'
        };
        cropTitle.textContent = titles[cropType] || 'Ajustar Imagem';
        
        // Limpar cropper anterior se existir
        if (currentCropper) {
            currentCropper.destroy();
            currentCropper = null;
        }
        
        cropImage.src = imageSrc;
        cropModal.style.display = 'block';
        
        // Inicializar cropper após a imagem carregar
        cropImage.onload = () => {
            currentCropper = new Cropper(cropImage, {
                aspectRatio: aspectRatio,
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 0.8,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
                responsive: true,
                minContainerWidth: 300,
                minContainerHeight: 300
            });
        };
    };
    
    reader.readAsDataURL(file);
}

// Fechar modal de cropping
function closeCropModal() {
    const cropModal = document.getElementById('image-crop-modal');
    cropModal.style.display = 'none';
    
    if (currentCropper) {
        currentCropper.destroy();
        currentCropper = null;
    }
    
    currentCropType = null;
    currentCropCallback = null;
    
    // Limpar inputs de arquivo
    document.querySelectorAll('input[type="file"]').forEach(input => {
        if (input.files.length > 0) {
            input.value = '';
        }
    });
}

// Confirmar crop e processar imagem
function confirmCrop() {
    if (!currentCropper) {
        alert('Erro: Cropper não inicializado.');
        return;
    }
    
    const canvas = currentCropper.getCroppedCanvas({
        width: currentCropType === 'logo' || currentCropType === 'supplier-logo' ? 400 : (currentCropType === 'header-bg' ? 1200 : (currentCropType === 'product-photo' ? 400 : 800)),
        height: currentCropType === 'logo' || currentCropType === 'supplier-logo' ? 400 : (currentCropType === 'header-bg' ? 300 : (currentCropType === 'product-photo' ? 400 : 600)),
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });
    
    if (!canvas) {
        alert('Erro ao processar imagem.');
        return;
    }
    
    // Converter para base64
    const croppedImageData = canvas.toDataURL('image/jpeg', 0.9);
    
    // Chamar callback com a imagem recortada
    if (currentCropCallback) {
        currentCropCallback(croppedImageData);
    }
    
    closeCropModal();
}

// Funções de remoção
function removeCompanyLogo() {
    if (confirm('Tem certeza que deseja remover o logo da empresa?')) {
        companyData.logo = '';
        companyData.logoType = '';
        saveCompanyData();
        updateCompanyHeader();
        
        // Limpar previews
        const previewImg = document.getElementById('logo-preview');
        const previewVideo = document.getElementById('logo-preview-video');
        if (previewImg) {
            previewImg.style.display = 'none';
            previewImg.src = '';
        }
        if (previewVideo) {
            previewVideo.style.display = 'none';
            previewVideo.src = '';
        }
        
        document.getElementById('remove-logo-btn').style.display = 'none';
        document.getElementById('company-logo-input').value = '';
        alert('Logo removido com sucesso!');
    }
}

function removeCompanyHeaderBackground() {
    if (confirm('Tem certeza que deseja remover a imagem de fundo do cabeçalho?')) {
        companyData.headerImage = '';
        saveCompanyData();
        updateCompanyHeader();
        const preview = document.getElementById('company-header-preview');
        if (preview) {
            preview.style.backgroundImage = 'none';
            preview.innerHTML = '<span>Pré-visualização da imagem de fundo do cabeçalho.</span>';
        }
        document.getElementById('remove-header-bg-btn').style.display = 'none';
        document.getElementById('company-header-image-input').value = '';
        alert('Imagem de fundo removida com sucesso!');
    }
}

function resetButtonSettings() {
    if (confirm('Tem certeza que deseja restaurar as configurações padrão dos botões?')) {
        buttonStyleSettings = {
            textColor: '#ffffff',
            bgColor: 'rgba(255,255,255,0.2)',
            transparentBg: false,
            borderColor: 'rgba(255,255,255,0.3)',
            borderEnabled: true
        };
        localStorage.setItem('buttonStyleSettings', JSON.stringify(buttonStyleSettings));
        applyButtonStyles();
        loadButtonSettingsForm();
        alert('Configurações restauradas para o padrão!');
    }
}

// Manipular upload de imagem de suporte (removido - função mantida para compatibilidade)
function handleSupportImageUpload(e) {
    const file = e.target.files[0];
    if (!file) {
        console.error('Nenhum arquivo selecionado');
        return;
    }
    
    // Verificar se é uma imagem (PNG, JPG, JPEG, etc)
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type.toLowerCase())) {
        alert('Por favor, selecione um arquivo de imagem válido (JPG, PNG, etc).\nTipo de arquivo selecionado: ' + file.type);
        return;
    }
    
    console.log('Carregando imagem de suporte:', file.name, 'Tipo:', file.type);
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
        try {
            const imageData = event.target.result;
            
            // Verificar se a imagem foi carregada corretamente
            if (!imageData || imageData.trim() === '') {
                alert('Erro: A imagem não pôde ser carregada. Por favor, tente novamente.');
                return;
            }
            
            companyData.supportImage = imageData;
            console.log('Imagem de suporte carregada com sucesso. Tamanho:', imageData.length, 'caracteres');
            
            // Atualizar preview
            const preview = document.getElementById('support-image-preview');
            if (preview) {
                preview.src = imageData;
                preview.style.display = 'block';
                console.log('Preview atualizado');
            }
            
            // Atualizar imagem na tela de suporte IMEDIATAMENTE
            const supportImage = document.getElementById('support-image');
            if (supportImage) {
                supportImage.src = imageData;
                supportImage.style.display = 'block';
                supportImage.style.visibility = 'visible';
                supportImage.style.opacity = '1';
                console.log('Imagem de suporte atualizada na tela');
            }
            
            // Salvar dados
            saveCompanyData();
            console.log('Dados salvos no localStorage');
            
            // Atualizar imagem na tela de suporte (garantir)
            updateSupportImage();
            
            alert('Imagem de suporte (JPG) salva com sucesso!');
        } catch (error) {
            console.error('Erro ao processar imagem:', error);
            alert('Erro ao processar a imagem. Por favor, tente novamente.');
        }
    };
    
    reader.onerror = function(error) {
        console.error('Erro ao ler arquivo:', error);
        alert('Erro ao carregar a imagem. Por favor, verifique se o arquivo está correto e tente novamente.');
    };
    
    reader.onprogress = function(event) {
        if (event.lengthComputable) {
            const percentLoaded = Math.round((event.loaded / event.total) * 100);
            console.log('Carregando imagem:', percentLoaded + '%');
        }
    };
    
    // Ler o arquivo como Data URL (suporta JPG, PNG, etc)
    reader.readAsDataURL(file);
}

// Manipular submit do formulário da empresa
function handleCompanySubmit(e) {
    e.preventDefault();
    
    companyData.name = document.getElementById('company-name-input').value.trim() || 'Nome da Empresa';
    companyData.ownerName = document.getElementById('owner-name').value.trim();
    companyData.ownerContact = document.getElementById('owner-contact').value.trim();
    companyData.ownerEmail = document.getElementById('owner-email').value.trim();
    companyData.ownerBirthdate = document.getElementById('owner-birthdate').value;
    companyData.address = document.getElementById('company-address').value.trim();
    companyData.description = document.getElementById('company-description').value.trim();
    
    saveCompanyData();
    updateCompanyHeader();
    alert('Dados da empresa salvos com sucesso!');
}

// Salvar dados da empresa
function saveCompanyData() {
    localStorage.setItem('companyData', JSON.stringify(companyData));
    autoSave(); // Salvamento automático
}

// Upload de imagem de fundo do cabeçalho da empresa
function handleCompanyHeaderImageUpload(e) {
    const file = e.target.files[0];
    if (!file) {
        // Se limpar o arquivo, remover imagem de cabeçalho
        companyData.headerImage = '';
        saveCompanyData();
        updateCompanyHeader();
        const preview = document.getElementById('company-header-preview');
        if (preview) {
            preview.style.backgroundImage = 'none';
            preview.textContent = 'Pré-visualização da imagem de fundo do cabeçalho.';
        }
        return;
    }

    if (!(file.type === 'image/jpeg' || file.type === 'image/png')) {
        alert('Formato inválido. Selecione uma imagem JPG ou PNG.');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const imageData = event.target.result;
        companyData.headerImage = imageData;
        saveCompanyData();
        updateCompanyHeader();

        const preview = document.getElementById('company-header-preview');
        if (preview) {
            preview.style.backgroundImage = `url('${imageData}')`;
            preview.style.backgroundSize = 'contain';
            preview.style.backgroundRepeat = 'repeat';
            preview.style.backgroundPosition = 'center';
            preview.innerHTML = '';
        }

        alert('Imagem de fundo do cabeçalho aplicada com sucesso!');
    };

    reader.readAsDataURL(file);
}

// Aplicar estilos dos botões de navegação
function applyButtonStyles() {
    const bg = buttonStyleSettings.transparentBg ? 'transparent' : buttonStyleSettings.bgColor;
    const borderColor = buttonStyleSettings.borderEnabled ? buttonStyleSettings.borderColor : 'transparent';

    // Aplicar estilos aos botões de navegação
    document.documentElement.style.setProperty('--nav-btn-bg', bg);
    document.documentElement.style.setProperty('--nav-btn-text', buttonStyleSettings.textColor);
    document.documentElement.style.setProperty('--nav-btn-border-color', borderColor);

    // Aplicar estilos aos botões do usuário (Trocar e Sair)
    document.documentElement.style.setProperty('--user-btn-bg', bg);
    document.documentElement.style.setProperty('--user-btn-text', buttonStyleSettings.textColor);
    document.documentElement.style.setProperty('--user-btn-border-color', borderColor);

    // Aplicar estilos ao card do usuário
    document.documentElement.style.setProperty('--user-card-bg', bg);
    document.documentElement.style.setProperty('--user-card-border-color', borderColor);
    document.documentElement.style.setProperty('--user-name-text', buttonStyleSettings.textColor);
}

// Atualizar estatísticas
function updateStats() {
    document.getElementById('total-clients').textContent = clients.length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Clientes aniversariantes HOJE
    const todayBirthdayClients = clients.filter(client => {
        const birthDateStr = client.birthdate;
        if (!birthDateStr) return false;

        let cleanDateStr = birthDateStr;
        if (cleanDateStr.includes('T')) {
            cleanDateStr = cleanDateStr.split('T')[0];
        }

        const parts = cleanDateStr.split('-');
        if (parts.length !== 3) return false;

        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);

        return today.getDate() === day && today.getMonth() === month;
    });

    // Contadores para o card configurável
    const todayCount = todayBirthdayClients.length;
    let range1Count = 0;
    let range2Count = 0;

    const range1Days = birthdayCardSettings.range1Days || 7;
    const range2Days = birthdayCardSettings.range2Days || 30;

    // Função auxiliar para calcular dias até o próximo aniversário
    const getDaysToNextBirthday = (client) => {
        if (!client.birthdate) return null;
        let cleanDateStr = client.birthdate;
        if (cleanDateStr.includes('T')) {
            cleanDateStr = cleanDateStr.split('T')[0];
        }
        const parts = cleanDateStr.split('-');
        if (parts.length !== 3) return null;
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);

        let nextBirthday = new Date(today.getFullYear(), month, day);
        if (nextBirthday < today) {
            nextBirthday = new Date(today.getFullYear() + 1, month, day);
        }
        const diffMs = nextBirthday - today;
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    };

    clients.forEach(client => {
        const days = getDaysToNextBirthday(client);
        if (days === null || days === 0) return; // 0 já está na contagem de HOJE

        if (days > 0 && days <= range1Days) {
            range1Count++;
        }
        if (days > 0 && days <= range2Days) {
            range2Count++;
        }
    });

    // Atualizar textos e visibilidade do card de aniversários
    const todayEl = document.getElementById('birthday-count-today');
    const range1El = document.getElementById('birthday-count-range1');
    const range2El = document.getElementById('birthday-count-range2');
    const range1Wrapper = document.getElementById('birthday-stat-range1');
    const range2Wrapper = document.getElementById('birthday-stat-range2');
    const range1Label = document.getElementById('birthday-label-range1');
    const range2Label = document.getElementById('birthday-label-range2');

    if (todayEl) {
        todayEl.textContent = todayCount;
    }

    if (birthdayCardSettings.mode === 'today') {
        if (range1Wrapper) range1Wrapper.style.display = 'none';
        if (range2Wrapper) range2Wrapper.style.display = 'none';
    } else if (birthdayCardSettings.mode === 'today_range1') {
        if (range1Wrapper) range1Wrapper.style.display = 'block';
        if (range2Wrapper) range2Wrapper.style.display = 'none';
    } else {
        if (range1Wrapper) range1Wrapper.style.display = 'block';
        if (range2Wrapper) range2Wrapper.style.display = 'block';
    }

    if (range1El && range1Label) {
        range1El.textContent = range1Count;
        range1Label.textContent = `${range1Days} dias`;
    }
    if (range2El && range2Label) {
        range2El.textContent = range2Count;
        range2Label.textContent = `${range2Days} dias`;
    }

    // Atualizar lista de aniversariantes de hoje no dashboard
    renderTodayBirthdaysDashboard(todayBirthdayClients);
}

// Renderizar lista de aniversariantes de hoje no dashboard (somente HOJE)
function renderTodayBirthdaysDashboard(todayClients) {
    const container = document.getElementById('today-birthdays-dashboard');
    if (!container) return;

    container.innerHTML = '';

    // Título da seção
    const title = document.createElement('h3');
    title.textContent = 'Aniversariantes de Hoje';
    container.appendChild(title);

    if (!todayClients || todayClients.length === 0) {
        container.innerHTML += `
            <div class="empty-state">
                <h3>Nenhum aniversariante hoje</h3>
                <p>Quando houver aniversariantes, eles aparecerão aqui.</p>
            </div>
        `;
        return;
    }

    const list = document.createElement('div');
    list.className = 'clients-list';

    todayClients.forEach(client => {
        const card = document.createElement('div');
        // Reutiliza o estilo de card piscando da tela de felicitações
        card.className = 'client-card birthday-today';
        // Ao clicar no card, abrir fluxo de envio de felicitações
        card.onclick = () => {
            // Se a licença estiver expirada, apenas redirecionar para tela de licença (sem mostrar alerta)
            if (isLicenseExpired()) {
                showSection('license');
                return;
            }
            selectedClientId = client.id;
            const nameElement = document.getElementById('selected-client-name');
            if (nameElement) {
                nameElement.textContent = client.name || 'Cliente';
            }
            const modal = document.getElementById('send-method-modal');
            if (modal) {
                modal.style.display = 'block';
            }
        };

        const photoHtml = client.photo && client.photo.trim() !== ''
            ? `<img src="${client.photo}" alt="${client.name}" class="client-photo">`
            : `<div class="client-photo-placeholder">${client.name ? client.name.charAt(0).toUpperCase() : '?'}</div>`;

        card.innerHTML = `
            <div class="client-card-header">
                ${photoHtml}
                <div class="client-info">
                    <h3>
                        ${client.name || 'Cliente'}
                        ${wasGreetingSent(client) ? '<span class="greeting-sent-badge">Mensagem enviada</span>' : ''}
                    </h3>
                    <p><strong>Data de Nascimento:</strong> ${client.birthdate ? formatDate(client.birthdate) : 'Não informada'}</p>
                </div>
            </div>
        `;

        list.appendChild(card);
    });

    container.appendChild(list);
}

// Verificar aniversários e enviar mensagens automaticamente
function startBirthdayChecker() {
    // Verificar a cada minuto se chegou meia-noite
    setInterval(() => {
        const now = new Date();
        const lastCheck = localStorage.getItem('lastBirthdayCheck');
        const today = now.toDateString();
        
        // Só envia se for meia-noite e ainda não foi enviado hoje
        if (now.getHours() === 0 && now.getMinutes() === 0 && lastCheck !== today) {
            sendBirthdayMessages(true);
            localStorage.setItem('lastBirthdayCheck', today);
        }
    }, 60000); // Verifica a cada minuto
    
    // Verificar imediatamente se já passou da meia-noite hoje e ainda não foi verificado
    const lastCheck = localStorage.getItem('lastBirthdayCheck');
    const today = new Date().toDateString();
    
    if (lastCheck !== today) {
        const now = new Date();
        // Se já passou da meia-noite, verifica e envia
        if (now.getHours() >= 0) {
            sendBirthdayMessages(true);
            localStorage.setItem('lastBirthdayCheck', today);
        }
    }
}

// Abrir modal de seleção de cliente
function openSelectClientModal() {
    const filteredClients = getFilteredClients();
    
    if (filteredClients.length === 0) {
        alert('Nenhum cliente disponível para enviar felicitações no momento.');
        return;
    }
    
    const container = document.getElementById('select-clients-list');
    container.innerHTML = filteredClients.map(client => {
        const status = getBirthdayStatus(client);
        let statusText = '';
        
        if (status === 'today') {
            statusText = '<span style="color: #27ae60; font-weight: bold;">🎂 Aniversário Hoje</span>';
        } else if (status === 'past') {
            statusText = '<span style="color: #e74c3c;">Aniversário recente</span>';
        } else if (status === 'upcoming') {
            statusText = '<span style="color: #f39c12;">Aniversário próximo</span>';
        }
        
        return `
            <div class="select-client-item" onclick="selectClientForGreeting('${client.id}')">
                <div>
                    <h4>${client.name}</h4>
                    <p style="margin: 5px 0; color: #666;">${formatDate(client.birthdate)} - ${statusText}</p>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('select-client-modal').style.display = 'block';
}

// Fechar modal de seleção de cliente
function closeSelectClientModal() {
    document.getElementById('select-client-modal').style.display = 'none';
}

// Selecionar cliente para enviar felicitações
function selectClientForGreeting(clientId) {
    selectedClientId = clientId;
    const client = clients.find(c => c.id === clientId);
    
    if (!client) return;
    
    closeSelectClientModal();
    document.getElementById('selected-client-name').textContent = client.name;
    document.getElementById('send-method-modal').style.display = 'block';
}

// Fechar modal de método de envio
function closeSendMethodModal() {
    document.getElementById('send-method-modal').style.display = 'none';
    selectedClientId = null;
}

// Manipular escolha de método de envio
function handleSendMethod(method) {
    if (!selectedClientId) return;
    
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;
    
    closeSendMethodModal();
    
    if (method === 'whatsapp') {
        sendWhatsAppGreeting(client);
    } else if (method === 'email') {
        document.getElementById('email-client-name').textContent = client.name;
        document.getElementById('email-action-modal').style.display = 'block';
    }
}

// Enviar felicitações via WhatsApp
function sendWhatsAppGreeting(client) {
    if (!client.phones || client.phones.length === 0) {
        alert('Cliente não possui telefone cadastrado.');
        return;
    }
    
    const companyName = companyData.name || 'Nossa Empresa';
    const message = `🎉 Parabéns! A ${companyName} deseja um feliz aniversário! Que este dia seja especial e repleto de alegria! 🎂🎈`;
    
    const phone = client.phones[0].replace(/\D/g, ''); // Remove caracteres não numéricos
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    
    // Registrar envio
    markGreetingAsSent(client.id);
    addSystemLog('send_greeting', `Felicitação enviada via WhatsApp para cliente "${client.name}"`, currentUser ? currentUser.username : 'Sistema');
    loadClients(); // Recarregar lista de felicitações
    updateStats();
}

// Fechar modal de ação de email
function closeEmailActionModal() {
    document.getElementById('email-action-modal').style.display = 'none';
    selectedClientId = null;
}

// Manipular ação de email
function handleEmailAction(action) {
    if (!selectedClientId) return;
    
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;
    
    if (!client.emails || client.emails.length === 0) {
        alert('Cliente não possui email cadastrado.');
        closeEmailActionModal();
        return;
    }
    
    const email = client.emails[0];
    
    if (action === 'copy') {
        // Copiar email para área de transferência
        navigator.clipboard.writeText(email).then(() => {
            alert(`Email ${email} copiado para a área de transferência!`);
            markGreetingAsSent(client.id);
            addSystemLog('send_greeting', `Email copiado para envio de felicitação ao cliente "${client.name}"`, currentUser ? currentUser.username : 'Sistema');
            loadClients(); // Recarregar lista de felicitações
            updateStats();
        }).catch(() => {
            // Fallback para navegadores antigos
            const textArea = document.createElement('textarea');
            textArea.value = email;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert(`Email ${email} copiado para a área de transferência!`);
            markGreetingAsSent(client.id);
            addSystemLog('send_greeting', `Email copiado para envio de felicitação ao cliente "${client.name}"`, currentUser ? currentUser.username : 'Sistema');
            loadClients(); // Recarregar lista de felicitações
            updateStats();
        });
    } else if (action === 'gmail') {
        // Abrir Gmail
        const subject = encodeURIComponent(`🎉 Feliz Aniversário!`);
        const companyName = companyData.name || 'Nossa Empresa';
        const body = encodeURIComponent(`🎉 Parabéns! A ${companyName} deseja um feliz aniversário! Que este dia seja especial e repleto de alegria! 🎂🎈`);
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
        
        window.open(gmailUrl, '_blank');
        markGreetingAsSent(client.id);
        addSystemLog('send_greeting', `Felicitação enviada via Email para cliente "${client.name}"`, currentUser ? currentUser.username : 'Sistema');
        loadClients(); // Recarregar lista de felicitações
        updateStats();
    }
    
    closeEmailActionModal();
}

// Marcar felicitações como enviadas
function markGreetingAsSent(clientId) {
    sentGreetings[clientId] = new Date().toISOString();
    localStorage.setItem('sentGreetings', JSON.stringify(sentGreetings));
}

// Enviar mensagens de aniversário (função automática mantida para compatibilidade)
function sendBirthdayMessages(automatic = false) {
    const today = new Date();
    const birthdayClients = clients.filter(client => {
        const birthDate = new Date(client.birthdate);
        return birthDate.getDate() === today.getDate() && 
               birthDate.getMonth() === today.getMonth();
    });
    
    if (birthdayClients.length === 0) {
        if (!automatic) {
            alert('Nenhum cliente fazendo aniversário hoje!');
        }
        return;
    }
    
    if (automatic) {
        // Em modo automático, apenas registra no console
        console.log(`🎂 ${birthdayClients.length} cliente(s) fazendo aniversário hoje:`);
        birthdayClients.forEach(client => {
            console.log(`- ${client.name}`);
        });
        console.log('Use o botão "Enviar Felicitações" para enviar as mensagens.');
    }
}

// Formatar data
function formatDate(dateString) {
    // Remover parte de hora se existir
    let cleanDateStr = dateString;
    if (cleanDateStr.includes('T')) {
        cleanDateStr = cleanDateStr.split('T')[0];
    }
    
    // Parsear a data corretamente para evitar problemas de fuso horário
    const dateParts = cleanDateStr.split('-');
    if (dateParts.length === 3) {
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // Mês é 0-indexed
        const day = parseInt(dateParts[2]);
        const date = new Date(year, month, day);
        return date.toLocaleDateString('pt-BR');
    }
    // Fallback para formato antigo
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Calcular dias até o aniversário
function getDaysUntilBirthday(client) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Parsear a data de nascimento corretamente para evitar problemas de fuso horário
    const birthDateStr = client.birthdate;
    const birthDateParts = birthDateStr.split('-');
    const birthYear = parseInt(birthDateParts[0]);
    const birthMonth = parseInt(birthDateParts[1]) - 1; // Mês é 0-indexed
    const birthDay = parseInt(birthDateParts[2]);
    
    // Criar data local sem problemas de fuso horário
    const birthDate = new Date(birthYear, birthMonth, birthDay);
    const thisYearBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
    
    // Se o aniversário já passou este ano, calcular o do próximo ano
    if (thisYearBirthday < today) {
        const nextYearBirthday = new Date(today.getFullYear() + 1, birthMonth, birthDay);
        const daysDiff = Math.ceil((nextYearBirthday - today) / (1000 * 60 * 60 * 24));
        return daysDiff;
    }
    
    const daysDiff = Math.ceil((thisYearBirthday - today) / (1000 * 60 * 60 * 24));
    return daysDiff;
}

// Obter classe CSS do card baseado nos dias até aniversário
function getCardBirthdayClass(client) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Parsear a data de nascimento corretamente para evitar problemas de fuso horário
    const birthDateStr = client.birthdate;
    const birthDateParts = birthDateStr.split('-');
    const birthYear = parseInt(birthDateParts[0]);
    const birthMonth = parseInt(birthDateParts[1]) - 1; // Mês é 0-indexed
    const birthDay = parseInt(birthDateParts[2]);
    
    // Verificar se é aniversário HOJE (dia e mês iguais ao dia de hoje)
    const todayDay = today.getDate();
    const todayMonth = today.getMonth();
    
    const isToday = (todayDay === birthDay && todayMonth === birthMonth);
    
    // APENAS se for exatamente hoje, retornar piscante
    if (isToday) {
        return 'birthday-today'; // Piscante apenas se for hoje
    }
    
    // Calcular dias até o próximo aniversário
    const thisYearBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
    let daysUntil;
    
    if (thisYearBirthday < today) {
        // Aniversário já passou este ano, calcular do próximo ano
        const nextYearBirthday = new Date(today.getFullYear() + 1, birthMonth, birthDay);
        daysUntil = Math.ceil((nextYearBirthday - today) / (1000 * 60 * 60 * 24));
    } else {
        // Aniversário ainda não passou este ano
        daysUntil = Math.ceil((thisYearBirthday - today) / (1000 * 60 * 60 * 24));
    }
    
    // Aplicar cores apenas se faltar 7 dias ou menos (mas NÃO se for hoje, já tratado acima)
    if (daysUntil >= 1 && daysUntil <= 3) {
        return 'birthday-soon'; // Laranja para 1-3 dias
    } else if (daysUntil >= 4 && daysUntil <= 7) {
        return 'birthday-upcoming'; // Amarelo para 4-7 dias
    }
    
    return ''; // Normal para acima de 7 dias ou se já passou
}

// Obter HTML do indicador de dias até aniversário
function getBirthdayDaysIndicator(client) {
    // Verificar se é aniversário hoje primeiro (usando mesmo método de parseamento)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const birthDateStr = client.birthdate;
    const birthDateParts = birthDateStr.split('-');
    const birthMonth = parseInt(birthDateParts[1]) - 1;
    const birthDay = parseInt(birthDateParts[2]);
    
    const isToday = (today.getDate() === birthDay && today.getMonth() === birthMonth);
    
    if (isToday) {
        return `
            <div class="days-to-birthday">
                <span class="birthday-cake-icon">🎂</span>
                <span>Hoje!</span>
                <span class="days-indicator blinking"></span>
            </div>
        `;
    }
    
    const daysUntil = getDaysUntilBirthday(client);
    
    // Mostrar apenas se faltar menos de 30 dias
    if (daysUntil > 30) {
        return '';
    }
    
    let indicatorClass = '';
    let indicatorText = '';
    
    if (daysUntil <= 7) {
        // Entre 1 e 7 dias - laranja
        indicatorClass = 'orange';
        indicatorText = `${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}`;
    } else {
        // Mais de 7 dias (até 30) - amarelo
        indicatorClass = 'yellow';
        indicatorText = `${daysUntil} dias`;
    }
    
    return `
        <div class="days-to-birthday">
            <span class="birthday-cake-icon">🎂</span>
            <span>${indicatorText}</span>
            <span class="days-indicator ${indicatorClass}"></span>
        </div>
    `;
}

// Upload de foto do cliente
function handleClientPhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Abrir modal de cropping com aspect ratio 1:1 (quadrado) para foto de cliente
    openCropModal(file, 'client-photo', 1, (croppedImageData) => {
        document.getElementById('client-photo-preview').src = croppedImageData;
        document.getElementById('client-photo-preview').style.display = 'block';
        // Armazenar temporariamente para usar no submit
        window._pendingClientPhoto = croppedImageData;
    });
}

// Upload de foto ao editar cliente
function handleEditClientPhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Abrir modal de cropping com aspect ratio 1:1 (quadrado) para foto de cliente
    openCropModal(file, 'client-photo', 1, (croppedImageData) => {
        document.getElementById('edit-client-photo-preview').src = croppedImageData;
        document.getElementById('edit-client-photo-preview').style.display = 'block';
        // Armazenar temporariamente para usar no submit
        window._pendingEditClientPhoto = croppedImageData;
    });
}


// Salvamento Automático (Auto Save)
function autoSave() {
    // Verificar se o auto-save está habilitado
    if (!autoSaveEnabled) {
        return; // Não executar se estiver desativado
    }
    
    try {
        const backupData = {
            clients,
            products,
            suppliers,
            companyData,
            sentGreetings,
            licenseData,
            licenseActivations,
            used3DayKey,
            usedAnnualKeys,
            userThemeSettings,
            backupDate: new Date().toISOString(),
            autoSave: true // Identificador de que é um auto-save
        };
        
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'salvamento_automatico.json'; // Nome fixo - sempre sobrescreve
        link.style.display = 'none';
        document.body.appendChild(link);
        
        // Usar setTimeout para garantir que o download seja iniciado
        setTimeout(() => {
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
        }, 10);
        
        // Salvar também no localStorage para referência
        localStorage.setItem('lastAutoSave', new Date().toISOString());
        
        // Log silencioso (sem alert) - apenas no console
        if (currentUser) {
            addSystemLog('auto_save', 'Salvamento automático realizado', currentUser.username);
        }
    } catch (error) {
        console.error('Erro ao realizar salvamento automático:', error);
    }
}

// Alternar estado do Salvamento Automático
function toggleAutoSave() {
    // Verificar se o usuário é administrador
    if (!isAdmin()) {
        alert('⚠️ Acesso restrito! Apenas administradores podem alterar o salvamento automático.');
        // Restaurar estado anterior do toggle
        const toggleCheckbox = document.getElementById('auto-save-toggle');
        if (toggleCheckbox) {
            toggleCheckbox.checked = autoSaveEnabled;
        }
        return;
    }
    
    autoSaveEnabled = !autoSaveEnabled;
    localStorage.setItem('autoSaveEnabled', JSON.stringify(autoSaveEnabled));
    updateAutoSaveStatus();
    
    // Log da ação
    if (currentUser) {
        const action = autoSaveEnabled ? 'ativado' : 'desativado';
        addSystemLog('auto_save_toggle', `Salvamento automático ${action}`, currentUser.username);
    }
    
    // Mostrar feedback visual
    const statusText = autoSaveEnabled ? '✅ Salvamento automático ATIVADO' : '❌ Salvamento automático DESATIVADO';
    alert(statusText);
}

// Atualizar interface do status do Salvamento Automático
function updateAutoSaveStatus() {
    const toggleCheckbox = document.getElementById('auto-save-toggle');
    const labelElement = document.getElementById('auto-save-label');
    const toggleSwitch = toggleCheckbox ? toggleCheckbox.closest('.toggle-switch') : null;
    
    if (!toggleCheckbox || !labelElement) {
        return; // Elementos ainda não carregados
    }
    
    // Verificar se o usuário é administrador
    const isUserAdmin = isAdmin();
    
    // Atualizar o estado do checkbox
    toggleCheckbox.checked = autoSaveEnabled;
    
    // Desabilitar toggle se não for administrador
    toggleCheckbox.disabled = !isUserAdmin;
    
    // Adicionar classe CSS para indicar estado desabilitado
    if (toggleSwitch) {
        if (isUserAdmin) {
            toggleSwitch.classList.remove('toggle-disabled');
            toggleSwitch.style.opacity = '1';
            toggleSwitch.style.cursor = 'pointer';
        } else {
            toggleSwitch.classList.add('toggle-disabled');
            toggleSwitch.style.opacity = '0.6';
            toggleSwitch.style.cursor = 'not-allowed';
        }
    }
    
    // Atualizar o texto do label
    if (autoSaveEnabled) {
        labelElement.textContent = 'Salvamento Automático: Ativo';
        labelElement.classList.remove('inactive');
    } else {
        labelElement.textContent = 'Salvamento Automático: Inativo';
        labelElement.classList.add('inactive');
    }
    
    // Adicionar mensagem informativa se não for admin
    const description = document.querySelector('.auto-save-description');
    if (description) {
        if (!isUserAdmin) {
            // Verificar se a mensagem já foi adicionada
            const hasRestrictionMessage = description.querySelector('small');
            if (!hasRestrictionMessage) {
                const baseText = 'Quando ativado, o sistema salvará automaticamente os dados em "salvamento_automatico.json" após cada alteração.';
                description.innerHTML = baseText + '<br><small style="color: #999; font-style: italic; display: block; margin-top: 8px;">⚠️ Apenas administradores podem alterar esta configuração.</small>';
            }
        } else {
            // Remover mensagem de restrição se for admin
            const restrictionMessage = description.querySelector('small');
            if (restrictionMessage) {
                description.textContent = 'Quando ativado, o sistema salvará automaticamente os dados em "salvamento_automatico.json" após cada alteração.';
            }
        }
    }
}

// Backup dos dados (Manual - mantido inalterado)
function downloadBackup() {
    const backupData = {
        clients,
        products,
        suppliers,
        companyData,
        sentGreetings,
        licenseData,
        licenseActivations,
        used3DayKey,
        usedAnnualKeys,
        userThemeSettings, // Incluir configurações de tema
        backupDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addSystemLog('backup', 'Backup dos dados realizado', currentUser ? currentUser.username : 'Sistema');
    alert('Backup realizado com sucesso!');
}

// Restaurar backup
function restoreBackup() {
    const fileInput = document.getElementById('restore-file-input');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Por favor, selecione um arquivo de backup.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backupData = JSON.parse(e.target.result);
            
            if (confirm('Tem certeza que deseja restaurar este backup? Todos os dados atuais serão substituídos!')) {
                if (backupData.clients) clients = backupData.clients;
                if (backupData.companyData) companyData = backupData.companyData;
                if (backupData.sentGreetings) sentGreetings = backupData.sentGreetings;
                if (backupData.licenseData) licenseData = backupData.licenseData;
                if (backupData.licenseActivations) licenseActivations = backupData.licenseActivations;
                if (backupData.used3DayKey !== undefined) used3DayKey = backupData.used3DayKey;
                if (backupData.usedAnnualKeys) usedAnnualKeys = backupData.usedAnnualKeys;
                if (backupData.userThemeSettings) userThemeSettings = backupData.userThemeSettings; // Restaurar configurações de tema
                
                localStorage.setItem('clients', JSON.stringify(clients));
                localStorage.setItem('companyData', JSON.stringify(companyData));
                localStorage.setItem('sentGreetings', JSON.stringify(sentGreetings));
                localStorage.setItem('licenseData', JSON.stringify(licenseData));
                localStorage.setItem('licenseActivations', JSON.stringify(licenseActivations));
                localStorage.setItem('used3DayKey', JSON.stringify(used3DayKey));
                localStorage.setItem('usedAnnualKeys', JSON.stringify(usedAnnualKeys));
                localStorage.setItem('userThemeSettings', JSON.stringify(userThemeSettings)); // Salvar configurações de tema
                
                loadAllClients();
                loadClients();
                loadCompanyData();
                updateCompanyHeader();
                updateStats();
                updateLicenseStatus();
                
                // Recarregar tema após restaurar backup
                if (currentUser && currentUser.username) {
                    loadUserTheme();
                    setupThemeColorPicker();
                }
                
                addSystemLog('restore', 'Dados restaurados a partir de backup', currentUser ? currentUser.username : 'Sistema');
                alert('Backup restaurado com sucesso!');
                fileInput.value = '';
            }
        } catch (error) {
            alert('Erro ao restaurar backup. Arquivo inválido.');
            console.error(error);
        }
    };
    reader.readAsText(file);
}

// Suporte
function openSupportEmail() {
    const email = 'mcn.coutinho@gmail.com';
    const subject = encodeURIComponent('Suporte - Sistema de Gestão de Clientes');
    const body = encodeURIComponent('Olá, preciso de suporte...');
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`, '_blank');
}

function openSupportWhatsApp() {
    const phone = '5541988192359';
    const message = encodeURIComponent('Olá, preciso de suporte.');
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
}

// Funções de suporte para Marcio
function openSupportEmailMarcio() {
    const email = 'mendesmarciodji@gmail.com';
    const subject = encodeURIComponent('Suporte - Sistema de Gestão de Clientes');
    const body = encodeURIComponent('Olá, preciso de suporte...');
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`, '_blank');
}

function openSupportWhatsAppMarcio() {
    const phone = '5541998734231'; // 41 998734231 formatado para WhatsApp
    const message = encodeURIComponent('Olá, preciso de suporte.');
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
}

// Sistema de Licenças
// Verificar se licença está expirada
function isLicenseExpired() {
    if (!licenseData) return true;
    
    // Usar a data completa com horário para verificação precisa
    const expiresDate = new Date(licenseData.expiresDate);
    const now = new Date();
    
    // Se a data de expiração já passou (incluindo horário), está expirada
    return expiresDate < now;
}

// Obter chave esperada para o dia atual
function getTodayLicenseKey() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const dayMonth = `${day}/${month}`;
    return licenseKeys[dayMonth] || null;
}

// Obter ano da chave anual
function getAnnualKeyYear(key) {
    const keyUpper = key.toUpperCase();
    for (const [year, annualKey] of Object.entries(annualLicenseKeys)) {
        if (annualKey.toUpperCase() === keyUpper) {
            return parseInt(year);
        }
    }
    return null;
}

// Verificar se chave anual já foi usada
function wasAnnualKeyUsed(key) {
    return usedAnnualKeys[key.toUpperCase()] === true;
}

// Verificar se chave já foi ativada no ano atual
function wasKeyActivatedThisYear(key) {
    if (!licenseActivations[key]) {
        return false;
    }
    
    const currentYear = new Date().getFullYear();
    const activationYear = licenseActivations[key].year;
    
    return activationYear === currentYear;
}

// Validar chave de licença
function validateLicenseKey(key) {
    const keyUpper = key.toUpperCase();
    const currentYear = new Date().getFullYear();
    
    // Verificar se é uma chave anual
    const annualYear = getAnnualKeyYear(key);
    if (annualYear !== null) {
        // Verificar se o ano da chave corresponde ao ano atual
        if (annualYear !== currentYear) {
            return false; // Chave não pode ser usada neste ano
        }
        // Verificar se já foi usada
        if (wasAnnualKeyUsed(key)) {
            return false; // Chave anual só pode ser usada uma vez
        }
        return true; // Chave anual válida para o ano atual
    }
    
    // Chave especial de 3 dias (uso único)
    if (keyUpper === 'TEST-3DAY-VY19-EUCL') {
        if (used3DayKey) {
            return false; // Já foi usada, não pode usar novamente
        }
        return true;
    }
    
    // Chave especial de 5 minutos (uso ilimitado)
    if (keyUpper === 'TEST-5MIN-JOXS-RNM4') {
        return true; // Sempre válida, pode usar quantas vezes quiser
    }
    
    // Chaves normais (dia do ano)
    const todayKey = getTodayLicenseKey();
    
    // Verificar se a chave corresponde ao dia atual
    if (keyUpper !== todayKey?.toUpperCase()) {
        return false;
    }
    
    // Verificar se já foi ativada no ano atual
    if (wasKeyActivatedThisYear(key)) {
        return false; // Já foi ativada este ano, só pode ativar novamente no mesmo dia do próximo ano
    }
    
    return true;
}

// Manipular submit do formulário de licença
function handleLicenseSubmit(e) {
    e.preventDefault();
    
    const key = document.getElementById('license-key').value.trim().toUpperCase();
    
    if (!key || !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
        alert('Por favor, insira uma chave válida no formato XXXX-XXXX-XXXX-XXXX');
        return;
    }
    
    if (validateLicenseKey(key)) {
        const today = new Date();
        const keyUpper = key.toUpperCase();
        let validFor = 30;
        let expiresDate = new Date(today);
        const annualYear = getAnnualKeyYear(key);
        
        // Determinar validade baseado no tipo de chave
        if (annualYear !== null) {
            // Chave anual - válida por 1 ano (até o final do ano)
            validFor = 365; // Aproximadamente 1 ano
            expiresDate = new Date(annualYear, 11, 31, 23, 59, 59); // 31 de dezembro do ano da chave
            // Marcar chave anual como usada
            usedAnnualKeys[keyUpper] = true;
            localStorage.setItem('usedAnnualKeys', JSON.stringify(usedAnnualKeys));
        } else if (keyUpper === 'TEST-3DAY-VY19-EUCL') {
            validFor = 3;
            expiresDate.setDate(expiresDate.getDate() + 3);
            used3DayKey = true;
            localStorage.setItem('used3DayKey', JSON.stringify(used3DayKey));
        } else if (keyUpper === 'TEST-5MIN-JOXS-RNM4') {
            validFor = 0.003472; // 5 minutos em dias (aproximado)
            expiresDate.setMinutes(expiresDate.getMinutes() + 5);
        } else {
            // Chave normal (30 dias)
            expiresDate.setDate(expiresDate.getDate() + 30);
        }
        
        licenseData = {
            key,
            activatedDate: today.toISOString(),
            validFor: validFor,
            expiresDate: expiresDate.toISOString(),
            dayMonth: annualYear ? `Anual ${annualYear}` : (keyUpper.startsWith('TEST') ? 'Chave Especial' : `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`),
            isAnnual: annualYear !== null,
            annualYear: annualYear
        };
        
        // Registrar ativação no ano atual (exceto chave de 5 minutos que pode ser reativada)
        if (keyUpper !== 'TEST-5MIN-JOXS-RNM4') {
            licenseActivations[key] = {
                year: today.getFullYear(),
                activationDate: today.toISOString()
            };
            localStorage.setItem('licenseActivations', JSON.stringify(licenseActivations));
        }
        
        localStorage.setItem('licenseData', JSON.stringify(licenseData));
        autoSave(); // Salvamento automático após ativar licença
        
        // Formatar datas para exibição
        const activatedDateFormatted = formatDate(licenseData.activatedDate.split('T')[0]);
        const expiresDateFormatted = formatDate(licenseData.expiresDate.split('T')[0]);
        
        let validForText = annualYear ? `1 ano (até 31/12/${annualYear})` : (validFor === 3 ? '3 dias' : validFor < 1 ? '5 minutos' : '30 dias');
        const maskedKeyDisplay = 'XXXX-XXXX-XXXX-XXXX';
        
        addSystemLog('license_activate', `Licença ativada - Chave: ${maskedKeyDisplay}, Válida por: ${validForText}`, currentUser ? currentUser.username : 'Sistema');
        alert(`Licença ativada com sucesso!\n\nA licença está ativa por ${validForText}.\nData de ativação: ${activatedDateFormatted}\nData de validade final: ${expiresDateFormatted}`);
        
        updateLicenseStatus();
        document.getElementById('license-form').reset();
        // Aguardar um pouco para garantir que o localStorage foi atualizado
        setTimeout(() => {
            updateLicenseExpirationMessage(); // Atualizar mensagens após ativação
            checkLicenseAndBlockAccess(); // Verificar bloqueio após ativação - deve liberar tudo agora
        }, 100);
        showSection('license-status');
    } else {
        const keyUpper = key.toUpperCase();
        const annualYear = getAnnualKeyYear(key);
        
        if (annualYear !== null) {
            const currentYear = new Date().getFullYear();
            if (annualYear !== currentYear) {
                alert(`Esta chave é válida apenas para o ano ${annualYear}. O ano atual é ${currentYear}.`);
            } else if (wasAnnualKeyUsed(key)) {
                alert('Esta chave anual já foi utilizada. Cada chave anual só pode ser usada uma vez.');
            } else {
                alert('Chave de licença inválida. Por favor, verifique a chave.');
            }
        } else if (keyUpper === 'TEST-3DAY-VY19-EUCL' && used3DayKey) {
            alert('Esta chave de 3 dias já foi utilizada. Ela só pode ser usada uma vez por máquina.');
        } else {
            const todayKey = getTodayLicenseKey();
            if (keyUpper !== todayKey?.toUpperCase() && !keyUpper.startsWith('TEST-')) {
                alert('Chave de licença inválida. A chave não corresponde ao dia atual.');
            } else if (wasKeyActivatedThisYear(key)) {
                alert('Esta chave já foi ativada no ano atual. Ela só poderá ser ativada novamente no mesmo dia do próximo ano.');
            } else {
                alert('Chave de licença inválida. Por favor, verifique a chave.');
            }
        }
    }
}

// Atualizar status da licença
function updateLicenseStatus() {
    const container = document.getElementById('license-status-content');
    
    if (!licenseData) {
        container.innerHTML = `
            <div class="license-status-card">
                <h3>Status da Licença</h3>
                <p style="color: #e74c3c; font-weight: bold;">Nenhuma licença ativada</p>
                <p>Para ativar uma licença, acesse o menu "Adquirir Licença".</p>
            </div>
        `;
        return;
    }
    
    // Parsear datas corretamente (usar data completa com horário)
    const expiresDate = new Date(licenseData.expiresDate);
    const now = new Date();
    
    // Calcular diferença em milissegundos
    const diffMs = expiresDate - now;
    
    // Calcular dias, horas e minutos
    const totalSeconds = Math.floor(diffMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    
    // Formatar período para exibição
    let periodText = '';
    if (licenseData.validFor === 3) {
        periodText = '3 dias';
    } else if (licenseData.validFor < 1) {
        periodText = '5 minutos';
    } else {
        periodText = `${licenseData.validFor} dias`;
    }
    
    // Formatar tempo restante
    let timeRemainingText = '';
    if (diffMs < 0) {
        timeRemainingText = '0 dias, 0 horas, 0 minutos';
    } else {
        const parts = [];
        if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);
        if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
        if (minutes > 0 || parts.length === 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
        timeRemainingText = parts.join(', ');
    }
    
    let statusClass = 'status-active';
    let statusText = 'Ativa';
    
    if (diffMs < 0) {
        statusClass = 'status-expired';
        statusText = 'Expirada';
    } else if (days <= 7 && days >= 0) {
        statusClass = 'status-warning';
        statusText = 'Expirando em breve';
    }
    
    const activatedDateStr = licenseData.activatedDate.split('T')[0];
    const expiresDateStr = licenseData.expiresDate.split('T')[0];
    
    container.innerHTML = `
        <div class="license-status-card">
            <h3>Status da Licença</h3>
            <p><strong>Chave:</strong> ${licenseData.key}</p>
            <p><strong>Dia/Mês da Chave:</strong> ${licenseData.dayMonth || 'N/A'}</p>
            <p><strong>Data de Ativação:</strong> ${formatDate(activatedDateStr)}</p>
            <p><strong>Período:</strong> ${periodText}</p>
            <p><strong>Data de Validade Final:</strong> ${formatDate(expiresDateStr)}</p>
            <p><strong>Status:</strong> <span class="${statusClass}">${statusText}</span></p>
            <p><strong>Tempo Restante:</strong> <span class="${statusClass}">${timeRemainingText}</span></p>
        </div>
    `;
}

// Carregar status da licença ao inicializar
if (licenseData) {
    const expiresDateStr = licenseData.expiresDate.split('T')[0];
    const expiresDate = new Date(expiresDateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (expiresDate < today) {
        licenseData = null;
        localStorage.removeItem('licenseData');
    }
}

// Mostrar visualização de lista de clientes
function showClientsListView() {
    document.getElementById('clients-list-view').classList.add('active');
    document.getElementById('clients-register-view').classList.remove('active');
    
    // Atualizar botões do sidebar
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-btn')[0].classList.add('active');
    
    // Recarregar lista
    loadAllClients();
}

// Mostrar visualização de cadastro
function showClientsRegisterView() {
    document.getElementById('clients-list-view').classList.remove('active');
    document.getElementById('clients-register-view').classList.add('active');
    
    // Atualizar botões do sidebar
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-btn')[1].classList.add('active');
}

// Verificar licença e bloquear acesso
function checkLicenseAndBlockAccess() {
    // Sempre atualizar mensagens primeiro
    updateLicenseExpirationMessage();
    
    // Se licença estiver expirada, bloquear acesso
    if (isLicenseExpired()) {
        // Bloquear todos os menus exceto adquirir licença e suporte
        // O bloqueio será feito na função showSection, então não precisamos modificar os event listeners aqui
    } else {
        // Se licença estiver ativa, garantir que todas as funções estejam liberadas
        // Os event listeners já estão configurados normalmente no setupEventListeners
        // Não precisamos fazer nada adicional aqui
    }
}

// Atualizar card de status da licença no header
function updateLicenseStatusHeader() {
    const statusCard = document.getElementById('license-status-card');
    const statusText = document.getElementById('license-status-text');
    const timeText = document.getElementById('license-time-text');
    
    if (!statusCard || !statusText || !timeText) return;
    
    if (!licenseData) {
        statusCard.className = 'license-status-card-header expired';
        statusText.textContent = 'Sua licença venceu';
        timeText.textContent = '--:--:--';
        return;
    }
    
    // Calcular tempo restante
    const expiresDate = new Date(licenseData.expiresDate);
    const now = new Date();
    const diffMs = expiresDate - now;
    
    if (diffMs < 0) {
        // Licença expirada
        statusCard.className = 'license-status-card-header expired';
        statusText.textContent = 'Sua licença venceu';
        timeText.textContent = '00:00:00';
    } else {
        // Licença ativa
        statusCard.className = 'license-status-card-header active';
        statusText.textContent = 'Licença Ativa';
        
        // Calcular horas, minutos e segundos
        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        // Formatar tempo
        const hoursStr = String(hours).padStart(2, '0');
        const minutesStr = String(minutes).padStart(2, '0');
        const secondsStr = String(seconds).padStart(2, '0');
        
        timeText.textContent = `${hoursStr}:${minutesStr}:${secondsStr}`;
    }
}

// Atualizar mensagens de expiração
function updateLicenseExpirationMessage() {
    if (isLicenseExpired()) {
        // Mostrar mensagem na tela de início
        const homeWarning = document.getElementById('license-expiration-warning-home');
        if (homeWarning) {
            homeWarning.style.display = 'block';
        }
        
        // Mostrar mensagem na tela de adquirir licença
        const licenseWarning = document.getElementById('license-expiration-warning-license');
        if (licenseWarning) {
            licenseWarning.style.display = 'block';
        }
        
        // Mostrar botão Suporte
        const supportBtn = document.getElementById('support-btn-expired');
        if (supportBtn) {
            supportBtn.style.display = 'block';
        }
    } else {
        // Esconder mensagens
        const homeWarning = document.getElementById('license-expiration-warning-home');
        if (homeWarning) {
            homeWarning.style.display = 'none';
        }
        
        const licenseWarning = document.getElementById('license-expiration-warning-license');
        if (licenseWarning) {
            licenseWarning.style.display = 'none';
        }
        
        const supportBtn = document.getElementById('support-btn-expired');
        if (supportBtn) {
            supportBtn.style.display = 'none';
        }
    }
}

// ============================================
// FUNÇÕES DO SISTEMA DE USUÁRIOS
// ============================================

// Salvar usuários no localStorage
function saveUsers() {
    localStorage.setItem('users', JSON.stringify(users));
}

// Carregar e exibir usuários
function loadUsers() {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    usersList.innerHTML = '';
    
    if (users.length === 0) {
        usersList.innerHTML = '<div class="empty-state"><h3>Nenhum usuário cadastrado</h3><p>Clique em "Cadastrar Usuário" para adicionar um novo usuário.</p></div>';
        return;
    }
    
    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'client-card';
        
        const photoHtml = user.photo ? 
            `<img src="${user.photo}" alt="${user.name}" class="client-photo">` : 
            `<div class="client-photo-placeholder">${user.name.charAt(0).toUpperCase()}</div>`;
        
        const accessLevelBadge = user.accessLevel === 'admin' ? 
            '<span class="access-badge admin">Admin</span>' : 
            '<span class="access-badge funcionario">Funcionário</span>';
        
        const isCoutinhoUser = user.username && user.username.toLowerCase() === 'coutinho';
        const isAdminUser = user.username && user.username.toLowerCase() === 'admin';
        const isProtectedUser = isCoutinhoUser || isAdminUser || (user.isDefault && (user.id === 'coutinho-default' || user.id === 'admin-default'));
        
        const loggedIsCoutinho = currentUser && currentUser.username && currentUser.username.toLowerCase() === 'coutinho';
        const loggedIsAdmin = currentUser && currentUser.username && currentUser.username.toLowerCase() === 'admin';
        const loggedIsAdminButNotCoutinho = currentUser && currentUser.accessLevel === 'admin' && !loggedIsCoutinho;
        
        // Funcionários não podem editar ou excluir usuários
        let editBtn = '';
        let deleteBtn = '';
        let permissionsBtn = '';
        
        if (isCoutinhoUser) {
            // Coutinho (super admin) - não pode ter permissões editadas (sempre tem acesso total)
            // Não mostrar botão de permissões para ele mesmo
            deleteBtn = '';
            
            // Edição só permitida para o próprio usuário
            editBtn = loggedIsCoutinho ? 
                `<button class="btn btn-edit" onclick="openEditUserModal('${user.id}')">✏️ Editar</button>` :
                '<button class="btn btn-edit" onclick="alert(\'Somente o usuário Coutinho pode editar seus próprios dados.\')" title="Restrito">✏️ Editar</button>';
            
            // Coutinho pode gerenciar permissões de todos, mas não de si mesmo
            // (não mostrar botão de permissões para ele mesmo)
        } else if (isAdminUser) {
            // Admin (outro administrador)
            deleteBtn = '';
            
            // Edição só permitida para o próprio usuário
            editBtn = loggedIsAdmin ? 
                `<button class="btn btn-edit" onclick="openEditUserModal('${user.id}')">✏️ Editar</button>` :
                '<button class="btn btn-edit" onclick="alert(\'Somente o usuário admin pode editar seus próprios dados.\')" title="Restrito">✏️ Editar</button>';
            
            // Apenas Coutinho pode editar permissões de outros administradores
            if (loggedIsCoutinho) {
                permissionsBtn = `<button class="btn btn-info" onclick="openUserPermissionsModal('${user.id}')" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">🔐 Permissões</button>`;
            }
        } else if (isProtectedUser) {
            // Outros usuários protegidos
            deleteBtn = '';
            editBtn = '<button class="btn btn-edit" onclick="alert(\'Este usuário não pode ser editado.\')" title="Usuário protegido">✏️ Editar</button>';
            
            // Apenas Coutinho pode editar permissões de usuários protegidos
            if (loggedIsCoutinho) {
                permissionsBtn = `<button class="btn btn-info" onclick="openUserPermissionsModal('${user.id}')" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">🔐 Permissões</button>`;
            }
        } else if (isAdmin()) {
            // Administradores podem editar, excluir e gerenciar permissões de funcionários
            editBtn = `<button class="btn btn-edit" onclick="openEditUserModal('${user.id}')">✏️ Editar</button>`;
            deleteBtn = `<button class="btn btn-delete" onclick="deleteUser('${user.id}')">🗑️ Excluir</button>`;
            
            // Administradores podem gerenciar permissões de funcionários
            // Coutinho pode gerenciar permissões de todos
            if (loggedIsCoutinho || (loggedIsAdminButNotCoutinho && user.accessLevel !== 'admin')) {
                permissionsBtn = `<button class="btn btn-info" onclick="openUserPermissionsModal('${user.id}')" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">🔐 Permissões</button>`;
            }
        }
        
        userCard.innerHTML = `
            <div class="client-card-header">
                ${photoHtml}
                <div class="client-info">
                    <h3>${user.name}</h3>
                    <p><strong>Usuário:</strong> ${user.username}</p>
                    <p><strong>Email:</strong> ${user.email || 'Não informado'}</p>
                    <p><strong>Telefone:</strong> ${user.phone || 'Não informado'}</p>
                    ${accessLevelBadge}
                </div>
            </div>
            <div class="client-card-actions">
                ${editBtn}
                ${permissionsBtn}
                ${deleteBtn}
            </div>
        `;
        
        usersList.appendChild(userCard);
    });
}

// Mostrar visualização de lista de usuários
function showUsersListView() {
    document.getElementById('users-list-view').style.display = 'block';
    document.getElementById('users-register-view').style.display = 'none';
    loadUsers();
}

// Mostrar visualização de cadastro de usuário
function showUsersRegisterView() {
    document.getElementById('users-list-view').style.display = 'none';
    document.getElementById('users-register-view').style.display = 'block';
    document.getElementById('user-form').reset();
    document.getElementById('user-form-title').textContent = 'Cadastrar Novo Usuário';
    document.getElementById('user-photo-preview').style.display = 'none';
    editingUserId = null;
}

// Manipular upload de foto do usuário
function handleUserPhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Abrir modal de cropping com aspect ratio 1:1 (quadrado) para foto de usuário
    openCropModal(file, 'user-photo', 1, (croppedImageData) => {
        document.getElementById('user-photo-preview').src = croppedImageData;
        document.getElementById('user-photo-preview').style.display = 'block';
        // Armazenar temporariamente para usar no submit
        window._pendingUserPhoto = croppedImageData;
    });
}

// Manipular upload de foto do usuário (edição)
function handleEditUserPhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Abrir modal de cropping com aspect ratio 1:1 (quadrado) para foto de usuário
    openCropModal(file, 'user-photo', 1, (croppedImageData) => {
        document.getElementById('edit-user-photo-preview').src = croppedImageData;
        document.getElementById('edit-user-photo-preview').style.display = 'block';
        // Armazenar temporariamente para usar no submit
        window._pendingEditUserPhoto = croppedImageData;
    });
}

// Manipular submit do formulário de usuário
function handleUserSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('user-name').value.trim();
    const username = document.getElementById('user-username').value.trim();
    const password = document.getElementById('user-password').value;
    const birthdate = document.getElementById('user-birthdate').value;
    const phone = document.getElementById('user-phone').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const accessLevel = document.getElementById('user-access-level').value;
    const photoInput = document.getElementById('user-photo-input');
    
    // Validações
    if (!name || !username || !password || !birthdate || !phone || !email || !accessLevel) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    // Verificar se o username já existe
    const usernameExists = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== editingUserId);
    if (usernameExists) {
        alert('Este nome de usuário já está em uso. Por favor, escolha outro.');
        return;
    }
    
    // Usar foto recortada se disponível, senão usar foto do preview
    let photo = '';
    if (window._pendingUserPhoto) {
        photo = window._pendingUserPhoto;
        window._pendingUserPhoto = null;
    } else {
        const preview = document.getElementById('user-photo-preview');
        if (preview && preview.src && preview.style.display !== 'none') {
            photo = preview.src;
        }
    }
    saveUserWithPhoto(name, username, password, birthdate, phone, email, accessLevel, photo);
}

// Salvar usuário com foto
function saveUserWithPhoto(name, username, password, birthdate, phone, email, accessLevel, photo) {
    if (editingUserId) {
        // Editar usuário existente
        const userIndex = users.findIndex(u => u.id === editingUserId);
        if (userIndex !== -1) {
            const user = users[userIndex];
            
            // Proteção para usuário Coutinho
            if (user.id === 'coutinho-default' && user.isDefault) {
                // Não permitir alterar senha do Coutinho
                users[userIndex] = {
                    ...user,
                    name,
                    username,
                    birthdate,
                    phone,
                    email,
                    accessLevel,
                    photo: photo || user.photo
                    // Senha não é alterada
                };
            } else {
                // Para outros usuários, atualizar tudo
                users[userIndex] = {
                    ...user,
                    name,
                    username,
                    password: password || user.password, // Se não informou nova senha, manter a atual
                    birthdate,
                    phone,
                    email,
                    accessLevel,
                    photo: photo || user.photo
                };
            }
            
            saveUsers();
            addSystemLog('edit_user', `Usuário "${name}" foi editado`, currentUser ? currentUser.username : 'Sistema');
            alert('Usuário atualizado com sucesso!');
            showUsersListView();
        }
    } else {
        // Criar novo usuário
        const newUser = {
            id: 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            name,
            username,
            password,
            birthdate,
            phone,
            email,
            photo,
            accessLevel,
            isDefault: false,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        saveUsers();
        addSystemLog('create_user', `Usuário "${name}" foi criado`, currentUser ? currentUser.username : 'Sistema');
        alert('Usuário cadastrado com sucesso!');
        showUsersListView();
    }
}

// Abrir modal de edição de usuário
function openEditUserModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const isCoutinhoUser = user.username && user.username.toLowerCase() === 'coutinho';
    const isAdminUser = user.username && user.username.toLowerCase() === 'admin';
    const loggedIsCoutinho = currentUser && currentUser.username && currentUser.username.toLowerCase() === 'coutinho';
    const loggedIsAdmin = currentUser && currentUser.username && currentUser.username.toLowerCase() === 'admin';
    
    // Verificar permissões de edição
    if (isCoutinhoUser && !loggedIsCoutinho) {
        alert('Somente o usuário Coutinho pode editar seus próprios dados.');
        return;
    }
    
    if (isAdminUser && !loggedIsAdmin) {
        alert('Somente o usuário admin pode editar seus próprios dados.');
        return;
    }
    
    editingUserId = userId;
    
    // Preencher formulário
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-name').value = user.name;
    document.getElementById('edit-user-username').value = user.username;
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-birthdate').value = user.birthdate;
    document.getElementById('edit-user-phone').value = user.phone;
    document.getElementById('edit-user-email').value = user.email;
    document.getElementById('edit-user-access-level').value = user.accessLevel;
    
    // Foto
    if (user.photo) {
        document.getElementById('edit-user-photo-preview').src = user.photo;
        document.getElementById('edit-user-photo-preview').style.display = 'block';
    } else {
        document.getElementById('edit-user-photo-preview').style.display = 'none';
    }
    
    // Desabilitar campos se for usuário protegido (Coutinho)
    const isCoutinhoProtected = isCoutinhoUser && user.id === 'coutinho-default';
    if (isCoutinhoProtected) {
        document.getElementById('edit-user-password').disabled = true;
        document.getElementById('edit-user-password').placeholder = 'Senha não pode ser alterada para este usuário';
    } else {
        document.getElementById('edit-user-password').disabled = false;
        document.getElementById('edit-user-password').placeholder = 'Nova Senha (deixe em branco para manter a atual)';
    }
    
    document.getElementById('edit-user-modal').style.display = 'block';
}

// Fechar modal de edição de usuário
function closeEditUserModal() {
    document.getElementById('edit-user-modal').style.display = 'none';
    editingUserId = null;
    document.getElementById('edit-user-form').reset();
}

// Manipular submit do formulário de edição de usuário
function handleEditUserSubmit(e) {
    e.preventDefault();
    
    const userId = document.getElementById('edit-user-id').value;
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const isCoutinhoUser = user.username && user.username.toLowerCase() === 'coutinho';
    const isAdminUser = user.username && user.username.toLowerCase() === 'admin';
    const loggedIsCoutinho = currentUser && currentUser.username && currentUser.username.toLowerCase() === 'coutinho';
    const loggedIsAdmin = currentUser && currentUser.username && currentUser.username.toLowerCase() === 'admin';
    
    // Verificar permissões de edição
    if (isCoutinhoUser && !loggedIsCoutinho) {
        alert('Somente o usuário Coutinho pode salvar alterações neste cadastro.');
        return;
    }
    
    if (isAdminUser && !loggedIsAdmin) {
        alert('Somente o usuário admin pode salvar alterações neste cadastro.');
        return;
    }
    
    const name = document.getElementById('edit-user-name').value.trim();
    const username = document.getElementById('edit-user-username').value.trim();
    const password = document.getElementById('edit-user-password').value;
    const birthdate = document.getElementById('edit-user-birthdate').value;
    const phone = document.getElementById('edit-user-phone').value.trim();
    const email = document.getElementById('edit-user-email').value.trim();
    const accessLevel = document.getElementById('edit-user-access-level').value;
    // Validações
    if (!name || !username || !birthdate || !phone || !email || !accessLevel) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    // Verificar se o username já existe (exceto o próprio usuário)
    const usernameExists = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== userId);
    if (usernameExists) {
        alert('Este nome de usuário já está em uso. Por favor, escolha outro.');
        return;
    }
    
    // Proteção para usuário Coutinho - senha não pode ser alterada
    const isCoutinhoProtected = (user.username && user.username.toLowerCase() === 'coutinho') || (user.isDefault && user.id === 'coutinho-default');
    if (isCoutinhoProtected && password) {
        alert('A senha do usuário Coutinho não pode ser alterada.');
        return;
    }
    
    // Usar foto recortada se disponível, senão manter foto atual ou usar preview
    let photo = user.photo || '';
    if (window._pendingEditUserPhoto) {
        photo = window._pendingEditUserPhoto;
        window._pendingEditUserPhoto = null;
    } else {
        const preview = document.getElementById('edit-user-photo-preview');
        if (preview && preview.src && preview.style.display !== 'none' && preview.src !== photo) {
            photo = preview.src;
        }
    }
    
    updateUserWithPhoto(userId, name, username, password, birthdate, phone, email, accessLevel, photo, isCoutinhoProtected);
}

// Atualizar usuário com foto
function updateUserWithPhoto(userId, name, username, password, birthdate, phone, email, accessLevel, photo, isCoutinhoProtected) {
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return;
    
    users[userIndex] = {
        ...users[userIndex],
        name,
        username,
        password: (isCoutinhoProtected || !password) ? users[userIndex].password : password,
        birthdate,
        phone,
        email,
        accessLevel,
        photo
    };
    
    saveUsers();
    addSystemLog('edit_user', `Usuário "${name}" foi editado`, currentUser ? currentUser.username : 'Sistema');
    alert('Usuário atualizado com sucesso!');
    closeEditUserModal();
    loadUsers();
    
    if (currentUser && currentUser.id === userId) {
        currentUser = {
            ...currentUser,
            name,
            username,
            accessLevel,
            photo
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        checkLoginStatus();
    }
}

// Excluir usuário
function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    // Proteção para usuários Coutinho e admin - não podem ser excluídos em hipótese nenhuma
    const isCoutinhoUser = user.username && user.username.toLowerCase() === 'coutinho';
    const isAdminUser = user.username && user.username.toLowerCase() === 'admin';
    const isProtected = isCoutinhoUser || isAdminUser || (user.isDefault && (user.id === 'coutinho-default' || user.id === 'admin-default'));
    
    if (isProtected) {
        alert('Este usuário não pode ser excluído. Usuários desenvolvedores/administradores do sistema são protegidos.');
        return;
    }
    
    if (confirm(`Tem certeza que deseja excluir o usuário "${user.name}"?`)) {
        users = users.filter(u => u.id !== userId);
        saveUsers();
        addSystemLog('delete_user', `Usuário "${user.name}" foi excluído`, currentUser ? currentUser.username : 'Sistema');
        alert('Usuário excluído com sucesso!');
        loadUsers();
    }
}

// ============================================
// SISTEMA DE LOGIN E AUTENTICAÇÃO
// ============================================

// Verificar status de login
function checkLoginStatus() {
    // Recarregar currentUser do localStorage
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
        } catch (e) {
            currentUser = null;
        }
    } else {
        currentUser = null;
    }
    
    // Recarregar configurações de tema do localStorage
    const savedThemeSettings = localStorage.getItem('userThemeSettings');
    if (savedThemeSettings) {
        try {
            userThemeSettings = JSON.parse(savedThemeSettings);
        } catch (e) {
            userThemeSettings = {};
        }
    } else {
        userThemeSettings = {};
    }
    
    const loggedIn = currentUser !== null;
    const loginScreen = document.getElementById('login-screen');
    const homeContent = document.getElementById('home-content');
    const userInfoHeader = document.getElementById('user-info-header');
    const loggedUserName = document.getElementById('logged-user-name');
    const loggedUserPhoto = document.getElementById('logged-user-photo');
    
    if (loginScreen && homeContent) {
        // Se estiver em modo de troca (usuário selecionado), mostrar tela de login mesmo com usuário logado
        if (selectedUserForSwitch) {
            loginScreen.style.display = 'flex';
            homeContent.style.display = 'none';
            // Manter informações do usuário no header (usuário atual ainda está logado)
            if (userInfoHeader && loggedUserName && currentUser) {
                userInfoHeader.style.display = 'flex';
                loggedUserName.textContent = currentUser.name;
                if (loggedUserPhoto) {
                    if (currentUser.photo) {
                        loggedUserPhoto.src = currentUser.photo;
                        loggedUserPhoto.style.display = 'block';
                    } else {
                        loggedUserPhoto.style.display = 'none';
                    }
                }
            }
        } else if (loggedIn) {
            loginScreen.style.display = 'none';
            homeContent.style.display = 'block';
            updateStats();
            // Mostrar informações do usuário no header
            if (userInfoHeader && loggedUserName) {
                userInfoHeader.style.display = 'flex';
                loggedUserName.textContent = currentUser.name;
                if (loggedUserPhoto) {
                    if (currentUser.photo) {
                        loggedUserPhoto.src = currentUser.photo;
                        loggedUserPhoto.style.display = 'block';
                    } else {
                        loggedUserPhoto.style.display = 'none';
                    }
                }
            }
            // Carregar tema personalizado do usuário logado
            loadUserTheme();
            // Configurar o seletor de cor com o tema do usuário
            setupThemeColorPicker();
            // Iniciar timeout de sessão se ainda não estiver ativo
            if (!sessionTimeoutId) {
                startSessionTimeout();
            }
            // Carregar alerta de estoque crítico se estiver na tela inicial
            if (document.getElementById('home') && document.getElementById('home').classList.contains('active')) {
                loadCriticalStockAlert();
            }
        } else {
            loginScreen.style.display = 'block';
            homeContent.style.display = 'none';
            // Esconder informações do usuário no header
            if (userInfoHeader) {
                userInfoHeader.style.display = 'none';
            }
            if (loggedUserPhoto) {
                loggedUserPhoto.style.display = 'none';
                loggedUserPhoto.src = '';
            }
            clearSessionTimeout();
        }
    }
    
    // Atualizar visibilidade dos menus de "Mais Opções" e botões
    updateMoreOptionsVisibility();
    updateInventoryMenuVisibility();
    updateNavigationVisibility();
    updateClientButtonsVisibility();
    
    // Atualizar visibilidade dos menus de navegação
    updateMenuVisibility();
}

// Atualizar visibilidade dos botões de clientes baseado no nível de acesso
function updateClientButtonsVisibility() {
    const cadastrarBtn = document.querySelector('.sidebar-btn[onclick*="showClientsRegisterView"]');
    if (cadastrarBtn) {
        if (isFuncionario()) {
            cadastrarBtn.style.display = 'none';
        } else {
            cadastrarBtn.style.display = 'block';
        }
    }
}

// Manipular login
function handleLogin(e) {
    e.preventDefault();
    
    let username, password;
    
    // Se houver usuário selecionado para troca, usar apenas senha
    if (selectedUserForSwitch) {
        username = selectedUserForSwitch.username;
        password = document.getElementById('login-password').value;
        
        if (!password) {
            alert('Por favor, informe a senha.');
            return;
        }
    } else {
        // Login normal: usuário e senha
        username = document.getElementById('login-username').value.trim();
        password = document.getElementById('login-password').value;
        
        if (!username || !password) {
            alert('Por favor, preencha todos os campos.');
            return;
        }
    }
    
    // Recarregar usuários do localStorage para garantir que temos os dados mais recentes
    users = JSON.parse(localStorage.getItem('users')) || [];
    
    // Se não houver usuários, inicializar os padrão
    if (users.length === 0) {
        initializeDefaultUsers();
        users = JSON.parse(localStorage.getItem('users')) || [];
    }
    
    // Verificar credenciais
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (user) {
        // Se estava trocando de usuário, registrar no log
        if (selectedUserForSwitch && currentUser) {
            addSystemLog('logout', `Usuário ${currentUser.name} (${currentUser.username}) trocou de usuário`, currentUser.username);
        }
        
        currentUser = {
            id: user.id,
            name: user.name,
            username: user.username,
            accessLevel: user.accessLevel,
            photo: user.photo || null,
            loginTime: new Date().toISOString()
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Registrar timestamp do login
        localStorage.setItem('lastActivity', new Date().toISOString());
        
        // Registrar login no log
        addSystemLog('login', `Usuário ${user.name} (${user.username}) realizou login`, user.username);
        
        // Limpar usuário selecionado para troca
        selectedUserForSwitch = null;
        
        // Restaurar formulário de login para modo normal
        const loginTitle = document.getElementById('login-title');
        const usernameGroup = document.getElementById('username-group');
        const selectedUserInfo = document.getElementById('selected-user-info');
        
        if (loginTitle) loginTitle.textContent = 'Login';
        if (usernameGroup) usernameGroup.style.display = 'block';
        if (selectedUserInfo) selectedUserInfo.style.display = 'none';
        
        // Mostrar mensagem de boas-vindas
        alert(`Bem-vindo, ${user.name}!`);
        
        // Iniciar timeout de sessão
        startSessionTimeout();
        
        // Limpar formulário
        document.getElementById('login-form').reset();
        
        // Forçar atualização do status de login
        checkLoginStatus();
        
        // Atualizar visibilidade dos menus
        updateMoreOptionsVisibility();
        updateInventoryMenuVisibility();
        updateNavigationVisibility();
        updateClientButtonsVisibility();
        
        // Atualizar visibilidade dos menus de navegação (mostrar após login bem-sucedido)
        updateMenuVisibility();
        
        // Aguardar um pouco e então mostrar a tela de início para garantir que a UI seja atualizada
        setTimeout(() => {
            showSection('home');
            updateStats();
            // Carregar tema personalizado do usuário APENAS após login bem-sucedido
            loadUserTheme();
            setupThemeColorPicker();
        }, 100);
    } else {
        if (selectedUserForSwitch) {
            alert('Senha incorreta. Por favor, verifique e tente novamente.');
        } else {
            alert('Usuário ou senha incorretos. Por favor, verifique os dados e tente novamente.\n\nUsuário padrão: admin\nSenha padrão: admin');
        }
    }
}

// Lógica central de logout (sem confirmação)
function performLogout() {
    // Realizar auto-save antes de sair
    autoSave();
    
    // Aplicar tema padrão IMEDIATAMENTE ao fazer logout
    applyDefaultTheme();
    
    if (currentUser) {
        addSystemLog('logout', `Usuário ${currentUser.name} (${currentUser.username}) realizou logout`, currentUser.username);
    }
    currentUser = null;
    selectedUserForSwitch = null; // Limpar também usuário selecionado para troca
    localStorage.removeItem('currentUser');
    localStorage.removeItem('lastActivity');
    clearSessionTimeout();
    
    // Restaurar formulário de login para modo normal
    const loginTitle = document.getElementById('login-title');
    const usernameGroup = document.getElementById('username-group');
    const selectedUserInfo = document.getElementById('selected-user-info');
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    
    if (loginTitle) loginTitle.textContent = 'Login';
    if (usernameGroup) usernameGroup.style.display = 'block';
    if (selectedUserInfo) selectedUserInfo.style.display = 'none';
    if (loginUsername) loginUsername.value = '';
    if (loginPassword) loginPassword.value = '';
    
    // Atualizar visibilidade dos menus (esconder tudo no logout total)
    updateMenuVisibility();
    
    checkLoginStatus();
    // Voltar para a tela de início (que mostrará o login)
    showSection('home');
}

// Logout acionado pelo botão "Sair" (com confirmação)
function handleLogout() {
    const confirmMessage = 'Você tem certeza que deseja desconectar do usuário atual?';
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Se confirmar, prosseguir com logout
    performLogout();
}

// Trocar de usuário - Abre modal de seleção
function switchUser() {
    // Realizar auto-save antes de trocar usuário
    autoSave();
    
    // Primeiro, pedir confirmação
    const confirmMessage = 'Você tem certeza que deseja alterar o usuário conectado?';
    
    if (!confirm(confirmMessage)) {
        // Se o usuário cancelar, manter logado e não fazer nada
        return;
    }
    
    // Se confirmar, esconder menus IMEDIATAMENTE antes de abrir o modal
    // Criar um estado temporário para indicar que está em processo de troca
    // Isso fará com que os menus fiquem escondidos mesmo antes de selecionar o usuário
    const navMenu = document.querySelector('.nav-menu');
    const userInfoHeader = document.getElementById('user-info-header');
    
    if (navMenu) navMenu.style.display = 'none';
    if (userInfoHeader) userInfoHeader.style.display = 'none';
    
    // Abrir modal de seleção de usuários
    openSelectUserModal();
}

// Abrir modal de seleção de usuários
function openSelectUserModal() {
    const modal = document.getElementById('select-user-modal');
    const usersList = document.getElementById('users-select-list');
    
    if (!modal || !usersList) return;
    
    // Recarregar usuários do localStorage
    users = JSON.parse(localStorage.getItem('users')) || [];
    
    // Se não houver usuários, inicializar os padrão
    if (users.length === 0) {
        initializeDefaultUsers();
        users = JSON.parse(localStorage.getItem('users')) || [];
    }
    
    // Limpar lista anterior
    usersList.innerHTML = '';
    
    // Filtrar usuário atual (não mostrar na lista)
    const availableUsers = users.filter(u => !currentUser || u.username !== currentUser.username);
    
    if (availableUsers.length === 0) {
        usersList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Nenhum outro usuário disponível.</p>';
    } else {
        // Criar cards para cada usuário
        availableUsers.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'select-client-item';
            userCard.style.cursor = 'pointer';
            userCard.onclick = () => selectUserForSwitch(user);
            
            const userInfo = document.createElement('div');
            userInfo.style.display = 'flex';
            userInfo.style.alignItems = 'center';
            userInfo.style.gap = '15px';
            
            // Foto do usuário ou placeholder
            if (user.photo) {
                const photo = document.createElement('img');
                photo.src = user.photo;
                photo.style.width = '50px';
                photo.style.height = '50px';
                photo.style.borderRadius = '50%';
                photo.style.objectFit = 'cover';
                userInfo.appendChild(photo);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'client-photo-placeholder';
                placeholder.style.width = '50px';
                placeholder.style.height = '50px';
                placeholder.textContent = user.name.charAt(0).toUpperCase();
                userInfo.appendChild(placeholder);
            }
            
            const nameDiv = document.createElement('div');
            const name = document.createElement('h4');
            name.textContent = user.name;
            name.style.margin = '0';
            name.style.color = 'var(--primary-color)';
            
            const username = document.createElement('p');
            username.textContent = `@${user.username}`;
            username.style.margin = '5px 0 0 0';
            username.style.color = '#666';
            username.style.fontSize = '14px';
            
            nameDiv.appendChild(name);
            nameDiv.appendChild(username);
            userInfo.appendChild(nameDiv);
            
            userCard.appendChild(userInfo);
            usersList.appendChild(userCard);
        });
    }
    
    modal.style.display = 'block';
}

// Fechar modal de seleção de usuários
function closeSelectUserModal() {
    const modal = document.getElementById('select-user-modal');
    if (modal) {
        modal.style.display = 'none';
        selectedUserForSwitch = null;
        
        // Se houver usuário logado, manter logado e carregar tema do usuário atual
        if (currentUser) {
            // Mostrar menus novamente ao cancelar (fechar modal sem selecionar)
            updateMenuVisibility();
            loadUserTheme();
        } else {
            // Se não houver usuário logado, garantir que tema padrão esteja aplicado
            applyDefaultTheme();
            updateMenuVisibility();
        }
    }
}

// Selecionar usuário para troca
function selectUserForSwitch(user) {
    selectedUserForSwitch = user;
    
    // Fechar modal sem atualizar visibilidade (manter menus escondidos)
    const modal = document.getElementById('select-user-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // IMPORTANTE: NÃO fazer logout do usuário atual ainda
    // Apenas mostrar tela de senha com tema padrão
    
    // Aplicar tema padrão na tela de senha (antes da troca)
    applyDefaultTheme();
    
    // Garantir que menus estejam escondidos (não chamar updateMenuVisibility que pode mostrar)
    const navMenu = document.querySelector('.nav-menu');
    const userInfoHeader = document.getElementById('user-info-header');
    if (navMenu) navMenu.style.display = 'none';
    if (userInfoHeader) userInfoHeader.style.display = 'none';
    
    // Mostrar tela de login com usuário pré-selecionado
    // Mas manter o usuário atual logado até a senha ser confirmada
    showSection('home');
    
    // Atualizar formulário de login para modo de troca
    const loginTitle = document.getElementById('login-title');
    const usernameGroup = document.getElementById('username-group');
    const selectedUserInfo = document.getElementById('selected-user-info');
    const selectedUserName = document.getElementById('selected-user-name');
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    
    if (loginTitle) loginTitle.textContent = 'Trocar de Usuário';
    if (usernameGroup) usernameGroup.style.display = 'none';
    if (selectedUserInfo) selectedUserInfo.style.display = 'block';
    if (selectedUserName) selectedUserName.textContent = user.name + ' (@' + user.username + ')';
    if (loginUsername) loginUsername.value = user.username;
    if (loginPassword) {
        loginPassword.value = '';
        loginPassword.focus();
    }
    
    // Forçar exibição da tela de login (mas manter usuário atual logado)
    // Isso mostra a tela de senha, mas o usuário atual ainda está ativo
    const loginScreen = document.getElementById('login-screen');
    const homeContent = document.getElementById('home-content');
    
    if (loginScreen && homeContent) {
        loginScreen.style.display = 'flex';
        homeContent.style.display = 'none';
    }
}

// Cancelar troca de usuário
function cancelUserSwitch() {
    selectedUserForSwitch = null;
    
    // Restaurar formulário de login normal
    const loginTitle = document.getElementById('login-title');
    const usernameGroup = document.getElementById('username-group');
    const selectedUserInfo = document.getElementById('selected-user-info');
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    
    if (loginTitle) loginTitle.textContent = 'Login';
    if (usernameGroup) usernameGroup.style.display = 'block';
    if (selectedUserInfo) selectedUserInfo.style.display = 'none';
    if (loginUsername) loginUsername.value = '';
    if (loginPassword) loginPassword.value = '';
    
    // Atualizar visibilidade dos menus (mostrar novamente após cancelar)
    updateMenuVisibility();
    
    // Se houver usuário logado, manter logado e carregar tema do usuário atual
    if (currentUser) {
        // Voltar para a tela principal (não mostrar login)
        const loginScreen = document.getElementById('login-screen');
        const homeContent = document.getElementById('home-content');
        
        if (loginScreen && homeContent) {
            loginScreen.style.display = 'none';
            homeContent.style.display = 'block';
        }
        
        // Carregar tema do usuário atual (não padrão)
        loadUserTheme();
        showSection('home');
    } else {
        // Se não houver usuário logado, mostrar tela de login normal com tema padrão
        applyDefaultTheme();
        checkLoginStatus();
    }
}

// Iniciar timeout de sessão
function startSessionTimeout() {
    // Limpar timeout anterior se existir
    clearSessionTimeout();
    
    // Atualizar última atividade
    localStorage.setItem('lastActivity', new Date().toISOString());
    
    // Configurar timeout para 5 minutos
    sessionTimeoutId = setTimeout(() => {
        if (currentUser) {
            alert('Você ficou mais de 5 minutos inativo. Por segurança, é necessário fazer login novamente.');
            performLogout();
        }
    }, SESSION_TIMEOUT);
}

// Limpar timeout de sessão
function clearSessionTimeout() {
    if (sessionTimeoutId) {
        clearTimeout(sessionTimeoutId);
        sessionTimeoutId = null;
    }
}

// Verificar se a sessão expirou ao carregar a página
function checkSessionTimeout() {
    const lastActivity = localStorage.getItem('lastActivity');
    if (!lastActivity || !currentUser) {
        return;
    }
    
    const lastActivityTime = new Date(lastActivity);
    const now = new Date();
    const timeDiff = now - lastActivityTime;
    
    // Se passou mais de 5 minutos, fazer logout
    if (timeDiff > SESSION_TIMEOUT) {
        if (currentUser) {
            alert('Você ficou mais de 5 minutos inativo. Por segurança, é necessário fazer login novamente.');
            performLogout();
        }
    } else {
        // Reiniciar timeout com o tempo restante
        const remainingTime = SESSION_TIMEOUT - timeDiff;
        sessionTimeoutId = setTimeout(() => {
            if (currentUser) {
                alert('Você ficou mais de 5 minutos inativo. Por segurança, é necessário fazer login novamente.');
                performLogout();
            }
        }, remainingTime);
    }
}

// Atualizar última atividade quando houver interação
function updateLastActivity() {
    if (currentUser) {
        localStorage.setItem('lastActivity', new Date().toISOString());
        // Reiniciar timeout
        startSessionTimeout();
    }
}

// ================================
// Configuração do card de aniversários
// ================================

function loadBirthdayCardSettingsIntoForm() {
    const modeSelect = document.getElementById('birthday-card-mode');
    const range1Input = document.getElementById('birthday-range1-days');
    const range2Input = document.getElementById('birthday-range2-days');

    if (!modeSelect || !range1Input || !range2Input) return;

    modeSelect.value = birthdayCardSettings.mode || 'today_range1_range2';
    range1Input.value = birthdayCardSettings.range1Days || 7;
    range2Input.value = birthdayCardSettings.range2Days || 30;

    // Atualizar pré-visualização da imagem de fundo, se existir
    const preview = document.getElementById('theme-bg-preview');
    if (preview) {
        const userTheme = currentUser ? userThemeSettings[currentUser.username] : null;
        if (userTheme && userTheme.backgroundImage) {
            preview.style.backgroundImage = `url('${userTheme.backgroundImage}')`;
            preview.innerHTML = '';
        } else {
            preview.style.backgroundImage = 'none';
            preview.textContent = 'Pré-visualização do fundo (a imagem será ajustada automaticamente para preencher).';
        }
    }
}

function saveBirthdayCardSettings() {
    const modeSelect = document.getElementById('birthday-card-mode');
    const range1Input = document.getElementById('birthday-range1-days');
    const range2Input = document.getElementById('birthday-range2-days');

    if (!modeSelect || !range1Input || !range2Input) return;

    const mode = modeSelect.value;
    let range1Days = parseInt(range1Input.value, 10);
    let range2Days = parseInt(range2Input.value, 10);

    if (isNaN(range1Days) || range1Days < 1) range1Days = 7;
    if (isNaN(range2Days) || range2Days < 1) range2Days = 30;

    birthdayCardSettings = {
        mode,
        range1Days,
        range2Days
    };

    localStorage.setItem('birthdayCardSettings', JSON.stringify(birthdayCardSettings));

    // Atualizar imediatamente o card do dashboard
    updateStats();

    alert('Configurações do card de aniversários salvas com sucesso!');
}

// ================================
// Upload de imagem de fundo do tema
// ================================

function handleThemeBackgroundUpload(e) {
    const file = e.target.files[0];
    if (!file) {
        // Se remover a seleção, apenas limpar preview; remoção definitiva será feita ao salvar
        const preview = document.getElementById('theme-bg-preview');
        if (preview) {
            preview.style.backgroundImage = 'none';
            preview.textContent = 'Pré-visualização do fundo (a imagem será ajustada automaticamente para preencher).';
        }
        window._pendingThemeBackgroundImage = null;
        return;
    }

    // Abrir modal de cropping com aspect ratio livre (NaN) para fundo do tema
    // O fundo pode ter qualquer proporção, então não forçamos aspect ratio
    openCropModal(file, 'theme-bg', NaN, (croppedImageData) => {
        // Guardar em memória para aplicar somente ao salvar
        window._pendingThemeBackgroundImage = croppedImageData;

        // Atualizar pré-visualização
        const preview = document.getElementById('theme-bg-preview');
        if (preview) {
            preview.style.backgroundImage = `url('${croppedImageData}')`;
            preview.innerHTML = '';
        }
    });
}

// ================================
// Definições dos botões de navegação
// ================================

function loadButtonSettingsForm() {
    const textInput = document.getElementById('btn-text-color');
    const bgInput = document.getElementById('btn-bg-color');
    const bgTransparent = document.getElementById('btn-bg-transparent');
    const borderColorInput = document.getElementById('btn-border-color');
    const borderEnabled = document.getElementById('btn-border-enabled');

    if (!textInput || !bgInput || !bgTransparent || !borderColorInput || !borderEnabled) return;

    // Converter rgba para hex se necessário
    function rgbaToHex(rgba) {
        if (rgba.startsWith('#')) return rgba;
        if (rgba.startsWith('rgba') || rgba.startsWith('rgb')) {
            const match = rgba.match(/\d+/g);
            if (match && match.length >= 3) {
                const r = parseInt(match[0]).toString(16).padStart(2, '0');
                const g = parseInt(match[1]).toString(16).padStart(2, '0');
                const b = parseInt(match[2]).toString(16).padStart(2, '0');
                return `#${r}${g}${b}`;
            }
        }
        return '#ffffff';
    }

    textInput.value = rgbaToHex(buttonStyleSettings.textColor || '#ffffff');
    bgInput.value = rgbaToHex(buttonStyleSettings.bgColor || 'rgba(255,255,255,0.2)');
    bgTransparent.checked = !!buttonStyleSettings.transparentBg;
    borderColorInput.value = rgbaToHex(buttonStyleSettings.borderColor || 'rgba(255,255,255,0.3)');
    borderEnabled.checked = buttonStyleSettings.borderEnabled !== false;
}

function saveButtonSettings() {
    const textInput = document.getElementById('btn-text-color');
    const bgInput = document.getElementById('btn-bg-color');
    const bgTransparent = document.getElementById('btn-bg-transparent');
    const borderColorInput = document.getElementById('btn-border-color');
    const borderEnabled = document.getElementById('btn-border-enabled');

    if (!textInput || !bgInput || !bgTransparent || !borderColorInput || !borderEnabled) return;

    buttonStyleSettings = {
        textColor: textInput.value || '#ffffff',
        bgColor: bgInput.value || '#ffffff',
        transparentBg: bgTransparent.checked,
        borderColor: borderColorInput.value || '#ffffff',
        borderEnabled: borderEnabled.checked
    };

    localStorage.setItem('buttonStyleSettings', JSON.stringify(buttonStyleSettings));

    // Aplicar imediatamente
    applyButtonStyles();

    alert('Definições dos botões salvas com sucesso!');
}

// ============================================
// SISTEMA DE LOGS
// ============================================

// Adicionar log ao sistema
function addSystemLog(action, description, username = null) {
    const logEntry = {
        id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        action: action,
        description: description,
        username: username || (currentUser ? currentUser.username : 'Sistema'),
        userId: currentUser ? currentUser.id : null
    };
    
    systemLogs.push(logEntry);
    localStorage.setItem('systemLogs', JSON.stringify(systemLogs));
    
    // Limpar logs antigos periodicamente
    if (systemLogs.length > 1000) {
        cleanOldLogs();
    }
}

// Limpar logs antigos baseado na retenção configurada
function cleanOldLogs() {
    const now = new Date();
    const retentionMs = logRetentionDays * 24 * 60 * 60 * 1000;
    
    systemLogs = systemLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        return (now - logDate) < retentionMs;
    });
    
    localStorage.setItem('systemLogs', JSON.stringify(systemLogs));
}

// Limpar logs antigos manualmente
function clearOldLogs() {
    if (confirm('Tem certeza que deseja limpar os logs antigos? Esta ação não pode ser desfeita.')) {
        cleanOldLogs();
        loadSystemLogs();
        alert('Logs antigos foram limpos com sucesso!');
    }
}

// Carregar logs do sistema
function loadSystemLogs(filters = {}) {
    const logsList = document.getElementById('logs-list');
    if (!logsList) return;
    
    let filteredLogs = [...systemLogs].reverse(); // Mais recentes primeiro
    
    // Aplicar filtros
    if (filters.date) {
        const filterDate = new Date(filters.date);
        filterDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        filteredLogs = filteredLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= filterDate && logDate < nextDay;
        });
    }
    
    if (filters.username) {
        filteredLogs = filteredLogs.filter(log => 
            log.username.toLowerCase().includes(filters.username.toLowerCase())
        );
    }
    
    if (filters.action) {
        filteredLogs = filteredLogs.filter(log => log.action === filters.action);
    }
    
    if (filteredLogs.length === 0) {
        logsList.innerHTML = '<div class="empty-state"><h3>Nenhum log encontrado</h3><p>Não há registros que correspondam aos filtros selecionados.</p></div>';
        return;
    }
    
    logsList.innerHTML = '';
    
    filteredLogs.forEach(log => {
        const logCard = document.createElement('div');
        logCard.className = 'log-entry';
        
        const logDate = new Date(log.timestamp);
        const formattedDate = formatDateTime(logDate);
        
        const actionLabels = {
            'login': '🔐 Login',
            'logout': '🚪 Logout',
            'create_client': '➕ Criar Cliente',
            'edit_client': '✏️ Editar Cliente',
            'delete_client': '🗑️ Excluir Cliente',
            'create_user': '➕ Criar Usuário',
            'edit_user': '✏️ Editar Usuário',
            'delete_user': '🗑️ Excluir Usuário',
            'send_greeting': '🎉 Enviar Felicitação',
            'backup': '💾 Backup',
            'restore': '📥 Restaurar',
            'license_activate': '🔑 Ativar Licença',
            'remove_greeting_client': '🚫 Remover Felicitação'
        };
        
        const actionLabel = actionLabels[log.action] || log.action;
        
        logCard.innerHTML = `
            <div class="log-entry-header">
                <span class="log-action">${actionLabel}</span>
                <span class="log-date">${formattedDate}</span>
            </div>
            <div class="log-entry-body">
                <p><strong>Usuário:</strong> ${log.username}</p>
                <p><strong>Descrição:</strong> ${log.description}</p>
            </div>
        `;
        
        logsList.appendChild(logCard);
    });
}

// Formatar data e hora
function formatDateTime(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Aplicar filtros de log
function applyLogFilters() {
    const dateFilter = document.getElementById('log-filter-date').value;
    const userFilter = document.getElementById('log-filter-user').value;
    const actionFilter = document.getElementById('log-filter-action').value;
    
    const filters = {};
    if (dateFilter) filters.date = dateFilter;
    if (userFilter) filters.username = userFilter;
    if (actionFilter) filters.action = actionFilter;
    
    loadSystemLogs(filters);
}

// Limpar filtros de log
function clearLogFilters() {
    document.getElementById('log-filter-date').value = '';
    document.getElementById('log-filter-user').value = '';
    document.getElementById('log-filter-action').value = '';
    loadSystemLogs();
}

// Mostrar configurações de log
function showLogSettings() {
    document.getElementById('log-retention-days').value = logRetentionDays;
    document.getElementById('log-settings-modal').style.display = 'block';
}

// Fechar configurações de log
function closeLogSettings() {
    document.getElementById('log-settings-modal').style.display = 'none';
}

// Salvar configurações de log
function saveLogSettings() {
    const retentionDays = parseInt(document.getElementById('log-retention-days').value);
    logRetentionDays = retentionDays;
    localStorage.setItem('logRetentionDays', logRetentionDays.toString());
    
    // Limpar logs antigos com nova configuração
    cleanOldLogs();
    
    alert('Configurações de log salvas com sucesso!');
    closeLogSettings();
    loadSystemLogs();
}

// ============================================
// TEMPO DE INATIVIDADE NO SISTEMA
// ============================================

// Carregar configurações de tempo de inatividade
function loadInactivityTimeoutSettings() {
    const adminHours = document.getElementById('admin-timeout-hours');
    const adminMinutes = document.getElementById('admin-timeout-minutes');
    const funcionarioHours = document.getElementById('funcionario-timeout-hours');
    const funcionarioMinutes = document.getElementById('funcionario-timeout-minutes');
    
    if (adminHours) adminHours.value = inactivityTimeoutSettings.admin?.hours || 0;
    if (adminMinutes) adminMinutes.value = inactivityTimeoutSettings.admin?.minutes || 0;
    if (funcionarioHours) funcionarioHours.value = inactivityTimeoutSettings.funcionario?.hours || 0;
    if (funcionarioMinutes) funcionarioMinutes.value = inactivityTimeoutSettings.funcionario?.minutes || 0;
}

// Salvar configurações de tempo de inatividade
function saveInactivityTimeout() {
    const adminHours = parseInt(document.getElementById('admin-timeout-hours').value) || 0;
    const adminMinutes = parseInt(document.getElementById('admin-timeout-minutes').value) || 0;
    const funcionarioHours = parseInt(document.getElementById('funcionario-timeout-hours').value) || 0;
    const funcionarioMinutes = parseInt(document.getElementById('funcionario-timeout-minutes').value) || 0;
    
    // Validar valores
    if (adminHours < 0 || adminHours > 23 || adminMinutes < 0 || adminMinutes > 59) {
        alert('Por favor, informe valores válidos para Administrador (horas: 0-23, minutos: 0-59).');
        return;
    }
    
    if (funcionarioHours < 0 || funcionarioHours > 23 || funcionarioMinutes < 0 || funcionarioMinutes > 59) {
        alert('Por favor, informe valores válidos para Funcionário (horas: 0-23, minutos: 0-59).');
        return;
    }
    
    inactivityTimeoutSettings = {
        admin: { hours: adminHours, minutes: adminMinutes },
        funcionario: { hours: funcionarioHours, minutes: funcionarioMinutes }
    };
    
    localStorage.setItem('inactivityTimeoutSettings', JSON.stringify(inactivityTimeoutSettings));
    alert('Configurações de tempo de inatividade salvas com sucesso!');
}

// ============================================
// PERMISSÕES DE USUÁRIOS
// ============================================

// Abrir modal de permissões
function openUserPermissionsModal(userId) {
    // Verificar se o usuário atual é administrador
    if (!currentUser || currentUser.accessLevel !== 'admin') {
        alert('⚠️ Apenas administradores podem editar permissões de usuários.');
        return;
    }
    
    const user = users.find(u => u.id === userId);
    if (!user) {
        alert('Usuário não encontrado.');
        return;
    }
    
    // Verificar se é Coutinho (super admin)
    const isCoutinho = user.username && user.username.toLowerCase() === 'coutinho';
    
    // Verificar se é outro administrador (não Coutinho)
    const isOtherAdmin = user.accessLevel === 'admin' && !isCoutinho;
    const currentUserIsAdmin = currentUser && currentUser.accessLevel === 'admin';
    const currentUserIsCoutinho = currentUser && currentUser.username && currentUser.username.toLowerCase() === 'coutinho';
    
    // Administradores não podem editar permissões de outros administradores (exceto Coutinho)
    if (isOtherAdmin && currentUserIsAdmin && !currentUserIsCoutinho) {
        alert('Você não pode editar permissões de outros administradores.');
        return;
    }
    
    editingPermissionsUserId = userId;
    document.getElementById('user-permissions-name').textContent = `Usuário: ${user.name} (${user.username})`;
    
    // Carregar formas de pagamento para criar permissões dinâmicas
    initializePaymentMethods();
    
    // Criar permissões padrão para formas de pagamento
    const defaultFormaPagamentoPermissions = {
        formaPagamento: true,
        formaPagamento_alterar: true
    };
    
    // Adicionar permissão padrão para cada forma de pagamento (ativa por padrão)
    paymentMethods.forEach(method => {
        defaultFormaPagamentoPermissions[`formaPagamento_${method.id}`] = method.active !== false;
    });
    
    // Carregar permissões do usuário (ou usar padrão)
    const permissions = userPermissions[userId] || {
        vender: true,
        vender_cancelarItemVenda: true,
        vender_editarItem: true,
        vender_aplicarDesconto: true,
        vender_localizarVenda: true,
        vender_outrasAcoes: true,
        ...defaultFormaPagamentoPermissions,
        controleEstoque: true,
        controleEstoque_clientes: true,
        controleEstoque_produtos: true,
        controleEstoque_brands: true,
        controleEstoque_categories: true,
        controleEstoque_suppliers: true,
        controleEstoque_entries: true,
        controleEstoque_exits: true,
        controleEstoque_receivables: true,
        controleEstoque_receivables_visualizar: true,
        controleEstoque_receivables_alterar: true,
        controleEstoque_receivables_alterarVencimento: false,
        controleEstoque_reports: true,
        controleEstoque_settings: true,
        maisOpcoes: true,
        maisOpcoes_perfilEmpresa: true,
        maisOpcoes_backup: true,
        maisOpcoes_restore: true,
        maisOpcoes_support: true,
        maisOpcoes_license: true,
        maisOpcoes_licenseStatus: true,
        maisOpcoes_users: true,
        maisOpcoes_systemLog: true,
        maisOpcoes_settings: true,
        maisOpcoes_birthdayCard: true,
        maisOpcoes_buttonSettings: true,
        maisOpcoes_inactivityTimeout: true
    };
    
    // Criar lista de permissões
    const permissionsList = document.getElementById('permissions-list');
    permissionsList.innerHTML = '';
    
    const menuOptions = [
        { key: 'vender', label: 'Vender', icon: '💰' },
        { key: 'formaPagamento', label: 'Forma de Pagamento', icon: '💳' },
        { key: 'controleEstoque', label: 'Controle de Estoque', icon: '📦' },
        { key: 'maisOpcoes', label: 'Mais Opções', icon: '⚙️' }
    ];
    
    // Sub-opções de Controle de Estoque
    const controleEstoqueSubOptions = [
        { key: 'controleEstoque_clientes', label: 'Clientes', icon: '👥' },
        { key: 'controleEstoque_produtos', label: 'Produtos', icon: '📦' },
        { key: 'controleEstoque_brands', label: 'Marca/Fabricante', icon: '🏷️' },
        { key: 'controleEstoque_categories', label: 'Categorias', icon: '📁' },
        { key: 'controleEstoque_suppliers', label: 'Fornecedor', icon: '🏢' },
        { key: 'controleEstoque_entries', label: 'Entradas/Recebimentos', icon: '📥' },
        { key: 'controleEstoque_exits', label: 'Saídas/Vendas', icon: '📤' },
        { key: 'controleEstoque_receivables', label: 'Contas a Receber', icon: '💰' },
        { key: 'controleEstoque_reports', label: 'Relatórios', icon: '📊' },
        { key: 'controleEstoque_settings', label: 'Configurações', icon: '⚙️' }
    ];
    
    // Sub-opções de Vender
    const venderSubOptions = [
        { key: 'vender_cancelarItemVenda', label: 'Cancelar Item/Venda', icon: '🗑️' },
        { key: 'vender_editarItem', label: 'Editar Item', icon: '✏️' },
        { key: 'vender_aplicarDesconto', label: 'Aplicar Desconto', icon: '💰' },
        { key: 'vender_localizarVenda', label: 'Localizar Venda', icon: '🔍' },
        { key: 'vender_outrasAcoes', label: 'Outras Ações', icon: '⚙️' }
    ];
    
    // Carregar formas de pagamento e criar sub-opções dinâmicas
    initializePaymentMethods();
    const formaPagamentoSubOptions = [
        { key: 'formaPagamento_alterar', label: 'Alterar Forma de Pagamento', icon: '💳' }
    ];
    
    // Adicionar cada forma de pagamento como sub-opção
    paymentMethods.forEach(method => {
        const methodKey = `formaPagamento_${method.id}`;
        formaPagamentoSubOptions.push({
            key: methodKey,
            label: method.name,
            icon: '💳',
            methodId: method.id
        });
    });
    
    // Sub-opções de Mais Opções
    const maisOpcoesSubOptions = [
        { key: 'maisOpcoes_perfilEmpresa', label: 'Perfil da Empresa', icon: '🏢' },
        { key: 'maisOpcoes_backup', label: 'Backup dos Dados', icon: '💾' },
        { key: 'maisOpcoes_restore', label: 'Restaurar Dados', icon: '📥' },
        { key: 'maisOpcoes_support', label: 'Suporte', icon: '🆘' },
        { key: 'maisOpcoes_license', label: 'Adquirir Licença', icon: '🔑' },
        { key: 'maisOpcoes_licenseStatus', label: 'Status da Licença', icon: '📊' },
        { key: 'maisOpcoes_users', label: 'Usuários', icon: '👥' },
        { key: 'maisOpcoes_systemLog', label: 'Log do Sistema', icon: '📋' },
        { key: 'maisOpcoes_settings', label: 'Cor do Tema', icon: '⚙️' },
        { key: 'maisOpcoes_birthdayCard', label: 'Card de Aniversários', icon: '🎂' },
        { key: 'maisOpcoes_buttonSettings', label: 'Definições dos Botões', icon: '🔘' },
        { key: 'maisOpcoes_inactivityTimeout', label: 'Tempo Inatividade no sistema', icon: '⏱️' }
    ];
    
    menuOptions.forEach(option => {
        const isEnabled = permissions[option.key] !== false; // Padrão é true
        const isDisabled = isCoutinho; // Coutinho sempre tem acesso total
        
        const permissionItem = document.createElement('div');
        permissionItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background: #f8f9fa; margin-bottom: 10px;';
        
        permissionItem.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;" onclick="toggleSubOptions('${option.key}')">
                <span style="font-size: 20px; transition: transform 0.3s;" id="arrow-${option.key}">▶</span>
                <span style="font-size: 24px;">${option.icon}</span>
                <span style="font-weight: 500; font-size: 16px;">${option.label}</span>
            </div>
            <label class="toggle-switch" style="position: relative; display: inline-block; width: 60px; height: 30px;">
                <input type="checkbox" id="permission-${option.key}" ${isEnabled ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} onchange="updatePermissionToggle('${option.key}')">
                <span class="toggle-slider" id="toggle-${option.key}"></span>
            </label>
        `;
        
        permissionsList.appendChild(permissionItem);
        updatePermissionToggle(option.key);
        
        // Criar container de sub-opções (inicialmente oculto)
        let subOptionsContainer = null;
        let subOptionsArray = [];
        
        if (option.key === 'vender') {
            subOptionsArray = venderSubOptions;
        } else if (option.key === 'formaPagamento') {
            subOptionsArray = formaPagamentoSubOptions;
        } else if (option.key === 'controleEstoque') {
            subOptionsArray = controleEstoqueSubOptions;
        } else if (option.key === 'maisOpcoes') {
            subOptionsArray = maisOpcoesSubOptions;
        }
        
        if (subOptionsArray.length > 0) {
            subOptionsContainer = document.createElement('div');
            subOptionsContainer.id = `sub-options-${option.key}`;
            subOptionsContainer.style.cssText = 'margin-left: 40px; margin-top: 10px; margin-bottom: 10px; display: none; flex-direction: column; gap: 8px;';
            
            subOptionsArray.forEach(subOption => {
                // Para formas de pagamento específicas, verificar se está ativa no sistema
                let subIsEnabled;
                if (subOption.methodId) {
                    // É uma forma de pagamento específica - verificar se está ativa no sistema E se tem permissão
                    const method = paymentMethods.find(m => m.id === subOption.methodId);
                    const hasPermission = permissions[subOption.key] !== false;
                    subIsEnabled = method && method.active && hasPermission;
                } else if (subOption.key === 'controleEstoque_receivables') {
                    // Contas a Receber - verificar permissão principal
                    subIsEnabled = permissions[subOption.key] !== false;
                } else {
                    // É uma opção geral - verificar apenas permissão
                    subIsEnabled = permissions[subOption.key] !== false;
                }
                const subIsDisabled = isCoutinho;
                
                const subPermissionItem = document.createElement('div');
                subPermissionItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; border: 1px solid #e0e0e0; border-radius: 6px; background: #ffffff;';
                
                const onChangeHandler = subOption.methodId 
                    ? `updatePaymentMethodPermission('${subOption.key}', ${subOption.methodId})`
                    : `updatePermissionToggle('${subOption.key}')`;
                
                subPermissionItem.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; ${subOption.key === 'controleEstoque_receivables' ? 'cursor: pointer; flex: 1;' : ''}" ${subOption.key === 'controleEstoque_receivables' ? `onclick="toggleSubOptions('${subOption.key}')"` : ''}>
                        ${subOption.key === 'controleEstoque_receivables' ? `<span style="font-size: 16px; transition: transform 0.3s;" id="arrow-${subOption.key}">▶</span>` : ''}
                        <span style="font-size: 18px;">${subOption.icon}</span>
                        <span style="font-weight: 400; font-size: 14px; color: #666;">${subOption.label}</span>
                    </div>
                    <label class="toggle-switch" style="position: relative; display: inline-block; width: 50px; height: 26px;">
                        <input type="checkbox" id="permission-${subOption.key}" ${subIsEnabled ? 'checked' : ''} ${subIsDisabled ? 'disabled' : ''} onchange="${onChangeHandler}">
                        <span class="toggle-slider" id="toggle-${subOption.key}" style="border-radius: 26px;"></span>
                    </label>
                `;
                
                subOptionsContainer.appendChild(subPermissionItem);
                updatePermissionToggle(subOption.key);
                
                // Se for Contas a Receber, criar sub-opções
                if (subOption.key === 'controleEstoque_receivables') {
                    const receivablesSubOptions = [
                        { key: 'controleEstoque_receivables_visualizar', label: 'Visualizar Informações', icon: '👁️' },
                        { key: 'controleEstoque_receivables_alterar', label: 'Alterar Dados', icon: '✏️' },
                        { key: 'controleEstoque_receivables_alterarVencimento', label: 'Alterar Data de Vencimento', icon: '🔒' }
                    ];
                    
                    const receivablesSubContainer = document.createElement('div');
                    receivablesSubContainer.id = `sub-options-${subOption.key}`;
                    receivablesSubContainer.style.cssText = 'margin-left: 40px; margin-top: 10px; margin-bottom: 10px; display: none; flex-direction: column; gap: 8px;';
                    
                    receivablesSubOptions.forEach(receivablesSub => {
                        const receivablesSubEnabled = permissions[receivablesSub.key] !== false;
                        const receivablesSubDisabled = isCoutinho;
                        
                        const receivablesSubItem = document.createElement('div');
                        receivablesSubItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; border: 1px solid #e0e0e0; border-radius: 6px; background: #f8f9fa;';
                        
                        receivablesSubItem.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 16px;">${receivablesSub.icon}</span>
                                <span style="font-weight: 400; font-size: 13px; color: #666;">${receivablesSub.label}</span>
                            </div>
                            <label class="toggle-switch" style="position: relative; display: inline-block; width: 50px; height: 26px;">
                                <input type="checkbox" id="permission-${receivablesSub.key}" ${receivablesSubEnabled ? 'checked' : ''} ${receivablesSubDisabled ? 'disabled' : ''} onchange="updatePermissionToggle('${receivablesSub.key}')">
                                <span class="toggle-slider" id="toggle-${receivablesSub.key}" style="border-radius: 26px;"></span>
                            </label>
                        `;
                        
                        receivablesSubContainer.appendChild(receivablesSubItem);
                        updatePermissionToggle(receivablesSub.key);
                    });
                    
                    subOptionsContainer.appendChild(receivablesSubContainer);
                    
                    // Se Contas a Receber estiver ativado, mostrar sub-opções
                    if (subIsEnabled) {
                        receivablesSubContainer.style.display = 'flex';
                        const arrow = document.getElementById(`arrow-${subOption.key}`);
                        if (arrow) arrow.style.transform = 'rotate(90deg)';
                    }
                    
                    // Adicionar listener para mostrar/ocultar sub-opções
                    const receivablesCheckbox = document.getElementById(`permission-${subOption.key}`);
                    if (receivablesCheckbox) {
                        receivablesCheckbox.addEventListener('change', function() {
                            receivablesSubContainer.style.display = this.checked ? 'flex' : 'none';
                            const arrow = document.getElementById(`arrow-${subOption.key}`);
                            if (arrow) {
                                arrow.style.transform = this.checked ? 'rotate(90deg)' : 'rotate(0deg)';
                            }
                        });
                    }
                }
            });
            
            permissionsList.appendChild(subOptionsContainer);
            
            // Se estiver ativado, mostrar sub-opções
            if (isEnabled) {
                subOptionsContainer.style.display = 'flex';
                document.getElementById(`arrow-${option.key}`).style.transform = 'rotate(90deg)';
            }
        }
        
    });
    
    // Adicionar listeners para mostrar/ocultar sub-opções quando os toggles principais forem alterados
    menuOptions.forEach(option => {
        const checkbox = document.getElementById(`permission-${option.key}`);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                const subOptionsContainer = document.getElementById(`sub-options-${option.key}`);
                const arrow = document.getElementById(`arrow-${option.key}`);
            if (subOptionsContainer) {
                subOptionsContainer.style.display = this.checked ? 'flex' : 'none';
                    if (arrow) {
                        arrow.style.transform = this.checked ? 'rotate(90deg)' : 'rotate(0deg)';
                    }
                }
            });
        }
    });
    
    document.getElementById('user-permissions-modal').style.display = 'block';
}

// Atualizar visual do toggle
function updatePermissionToggle(permissionKey) {
    const checkbox = document.getElementById(`permission-${permissionKey}`);
    const slider = document.getElementById(`toggle-${permissionKey}`);
    
    if (checkbox && slider) {
        if (checkbox.checked) {
            slider.style.background = '#4caf50'; // Verde quando ativado
        } else {
            slider.style.background = '#f44336'; // Vermelho quando desativado
        }
    }
    
    // Se "Vender" for desativado, desativar todas as sub-opções
    if (permissionKey === 'vender' && !checkbox.checked) {
        const subOptionsContainer = document.getElementById('sub-options-vender');
        if (subOptionsContainer) {
            subOptionsContainer.style.display = 'none';
            const arrow = document.getElementById('arrow-vender');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
            const subCheckboxes = subOptionsContainer.querySelectorAll('input[type="checkbox"]');
            subCheckboxes.forEach(subCheckbox => {
                subCheckbox.checked = false;
                const subKey = subCheckbox.id.replace('permission-', '');
                updatePermissionToggle(subKey);
            });
        }
    }
    
    // Se "Forma de Pagamento" for desativado, desativar todas as sub-opções
    if (permissionKey === 'formaPagamento' && !checkbox.checked) {
        const subOptionsContainer = document.getElementById('sub-options-formaPagamento');
        if (subOptionsContainer) {
            subOptionsContainer.style.display = 'none';
            const arrow = document.getElementById('arrow-formaPagamento');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
            const subCheckboxes = subOptionsContainer.querySelectorAll('input[type="checkbox"]');
            subCheckboxes.forEach(subCheckbox => {
                subCheckbox.checked = false;
                const subKey = subCheckbox.id.replace('permission-', '');
                updatePermissionToggle(subKey);
            });
        }
    }
    
    // Se "Controle de Estoque" for desativado, desativar todas as sub-opções
    if (permissionKey === 'controleEstoque' && !checkbox.checked) {
        const subOptionsContainer = document.getElementById('sub-options-controleEstoque');
        if (subOptionsContainer) {
            subOptionsContainer.style.display = 'none';
            const arrow = document.getElementById('arrow-controleEstoque');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
            const subCheckboxes = subOptionsContainer.querySelectorAll('input[type="checkbox"]');
            subCheckboxes.forEach(subCheckbox => {
                subCheckbox.checked = false;
                const subKey = subCheckbox.id.replace('permission-', '');
                updatePermissionToggle(subKey);
            });
        }
    }
    
    // Se "Mais Opções" for desativado, desativar todas as sub-opções
    if (permissionKey === 'maisOpcoes' && !checkbox.checked) {
        const subOptionsContainer = document.getElementById('sub-options-maisOpcoes');
        if (subOptionsContainer) {
            subOptionsContainer.style.display = 'none';
            const arrow = document.getElementById('arrow-maisOpcoes');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
            const subCheckboxes = subOptionsContainer.querySelectorAll('input[type="checkbox"]');
            subCheckboxes.forEach(subCheckbox => {
                subCheckbox.checked = false;
                const subKey = subCheckbox.id.replace('permission-', '');
                updatePermissionToggle(subKey);
            });
        }
    }
}

// Toggle para expandir/colapsar sub-opções
function toggleSubOptions(optionKey) {
    const subOptionsContainer = document.getElementById(`sub-options-${optionKey}`);
    const arrow = document.getElementById(`arrow-${optionKey}`);
    
    if (subOptionsContainer && arrow) {
        const isVisible = subOptionsContainer.style.display === 'flex';
        subOptionsContainer.style.display = isVisible ? 'none' : 'flex';
        arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(90deg)';
    }
}

// Atualizar permissão de forma de pagamento específica
function updatePaymentMethodPermission(permissionKey, methodId) {
    updatePermissionToggle(permissionKey);
    
    // Se for uma forma de pagamento específica, atualizar também o status ativo/inativo
    if (methodId) {
        const checkbox = document.getElementById(`permission-${permissionKey}`);
        if (checkbox) {
            const method = paymentMethods.find(m => m.id === methodId);
            if (method) {
                method.active = checkbox.checked;
                savePaymentMethods();
            }
        }
    }
}

// Fechar modal de permissões
function closeUserPermissionsModal() {
    document.getElementById('user-permissions-modal').style.display = 'none';
    editingPermissionsUserId = null;
}

// Salvar permissões do usuário
function saveUserPermissions() {
    // Verificar se o usuário atual é administrador
    if (!currentUser || currentUser.accessLevel !== 'admin') {
        alert('⚠️ Apenas administradores podem salvar permissões de usuários.');
        return;
    }
    
    if (!editingPermissionsUserId) return;
    
    const user = users.find(u => u.id === editingPermissionsUserId);
    const isCoutinho = user && user.username && user.username.toLowerCase() === 'coutinho';
    
    // Carregar formas de pagamento
    initializePaymentMethods();
    
    // Criar objeto de permissões base
    const permissions = {
        vender: isCoutinho ? true : document.getElementById('permission-vender').checked,
        vender_cancelarItemVenda: isCoutinho ? true : (document.getElementById('permission-vender_cancelarItemVenda')?.checked ?? true),
        vender_editarItem: isCoutinho ? true : (document.getElementById('permission-vender_editarItem')?.checked ?? true),
        vender_aplicarDesconto: isCoutinho ? true : (document.getElementById('permission-vender_aplicarDesconto')?.checked ?? true),
        vender_localizarVenda: isCoutinho ? true : (document.getElementById('permission-vender_localizarVenda')?.checked ?? true),
        vender_outrasAcoes: isCoutinho ? true : (document.getElementById('permission-vender_outrasAcoes')?.checked ?? true),
        formaPagamento: isCoutinho ? true : (document.getElementById('permission-formaPagamento')?.checked ?? true),
        formaPagamento_alterar: isCoutinho ? true : (document.getElementById('permission-formaPagamento_alterar')?.checked ?? true),
        controleEstoque: isCoutinho ? true : document.getElementById('permission-controleEstoque').checked,
        controleEstoque_clientes: isCoutinho ? true : (document.getElementById('permission-controleEstoque_clientes')?.checked ?? true),
        controleEstoque_produtos: isCoutinho ? true : (document.getElementById('permission-controleEstoque_produtos')?.checked ?? true),
        controleEstoque_brands: isCoutinho ? true : (document.getElementById('permission-controleEstoque_brands')?.checked ?? true),
        controleEstoque_categories: isCoutinho ? true : (document.getElementById('permission-controleEstoque_categories')?.checked ?? true),
        controleEstoque_suppliers: isCoutinho ? true : (document.getElementById('permission-controleEstoque_suppliers')?.checked ?? true),
        controleEstoque_entries: isCoutinho ? true : (document.getElementById('permission-controleEstoque_entries')?.checked ?? true),
        controleEstoque_exits: isCoutinho ? true : (document.getElementById('permission-controleEstoque_exits')?.checked ?? true),
        controleEstoque_receivables: isCoutinho ? true : (document.getElementById('permission-controleEstoque_receivables')?.checked ?? true),
        controleEstoque_receivables_visualizar: isCoutinho ? true : (document.getElementById('permission-controleEstoque_receivables_visualizar')?.checked ?? true),
        controleEstoque_receivables_alterar: isCoutinho ? true : (document.getElementById('permission-controleEstoque_receivables_alterar')?.checked ?? true),
        controleEstoque_receivables_alterarVencimento: isCoutinho ? true : (document.getElementById('permission-controleEstoque_receivables_alterarVencimento')?.checked ?? false),
        controleEstoque_reports: isCoutinho ? true : (document.getElementById('permission-controleEstoque_reports')?.checked ?? true),
        controleEstoque_settings: isCoutinho ? true : (document.getElementById('permission-controleEstoque_settings')?.checked ?? true),
        maisOpcoes: isCoutinho ? true : document.getElementById('permission-maisOpcoes').checked,
        maisOpcoes_perfilEmpresa: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_perfilEmpresa')?.checked ?? true),
        maisOpcoes_backup: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_backup')?.checked ?? true),
        maisOpcoes_restore: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_restore')?.checked ?? true),
        maisOpcoes_support: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_support')?.checked ?? true),
        maisOpcoes_license: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_license')?.checked ?? true),
        maisOpcoes_licenseStatus: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_licenseStatus')?.checked ?? true),
        maisOpcoes_users: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_users')?.checked ?? true),
        maisOpcoes_systemLog: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_systemLog')?.checked ?? true),
        maisOpcoes_settings: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_settings')?.checked ?? true),
        maisOpcoes_birthdayCard: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_birthdayCard')?.checked ?? true),
        maisOpcoes_buttonSettings: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_buttonSettings')?.checked ?? true),
        maisOpcoes_inactivityTimeout: isCoutinho ? true : (document.getElementById('permission-maisOpcoes_inactivityTimeout')?.checked ?? true)
    };
    
    // Adicionar permissões de formas de pagamento específicas
    paymentMethods.forEach(method => {
        const methodKey = `formaPagamento_${method.id}`;
        const checkbox = document.getElementById(`permission-${methodKey}`);
        if (checkbox) {
            permissions[methodKey] = isCoutinho ? true : checkbox.checked;
        }
    });
    
    userPermissions[editingPermissionsUserId] = permissions;
    localStorage.setItem('userPermissions', JSON.stringify(userPermissions));
    
    // Atualizar usuário no array
    const userIndex = users.findIndex(u => u.id === editingPermissionsUserId);
    if (userIndex !== -1) {
        users[userIndex].permissions = permissions;
        saveUsers();
    }
    
    alert('Permissões salvas com sucesso!');
    closeUserPermissionsModal();
    loadUsers(); // Recarregar lista de usuários
    
    // Atualizar visibilidade dos menus se for o próprio usuário logado
    if (editingPermissionsUserId === currentUser?.id) {
        updateMoreOptionsVisibility();
        updateInventoryMenuVisibility();
        updateNavigationVisibility();
    }
}

// Verificar se usuário tem permissão para acessar uma seção
// Verificar permissão específica de vendas
function hasSalesPermission(permissionKey) {
    if (!currentUser) return false;
    
    // Coutinho (super admin) sempre tem acesso total
    const isCoutinho = currentUser.username && currentUser.username.toLowerCase() === 'coutinho';
    if (isCoutinho) return true;
    
    // Administradores sempre têm permissão
    if (currentUser.accessLevel === 'admin') return true;
    
    // Verificar permissões do usuário
    const userPermissionsData = userPermissions[currentUser.id] || {};
    
    // Se não houver permissões salvas, usar padrão (todas permitidas)
    if (Object.keys(userPermissionsData).length === 0) {
        return true;
    }
    
    // Verificar permissão específica (padrão é true se não estiver definido como false)
    return userPermissionsData[permissionKey] !== false;
}

// Verificar permissão específica de Contas a Receber
function hasReceivablesPermission(permissionType) {
    if (!currentUser) return false;
    
    // Coutinho (super admin) sempre tem acesso total
    const isCoutinho = currentUser.username && currentUser.username.toLowerCase() === 'coutinho';
    if (isCoutinho) return true;
    
    // Administradores sempre têm permissão
    if (currentUser.accessLevel === 'admin') return true;
    
    // Verificar permissões do usuário
    const userPermissionsData = userPermissions[currentUser.id] || {};
    
    // Se não houver permissões salvas, usar padrão (todas permitidas)
    if (Object.keys(userPermissionsData).length === 0) {
        return true;
    }
    
    // Verificar se tem permissão para acessar Contas a Receber
    if (userPermissionsData['controleEstoque_receivables'] === false) {
        return false;
    }
    
    // Mapear tipo de permissão para chave
    const permissionMap = {
        'visualizar': 'controleEstoque_receivables_visualizar',
        'alterar': 'controleEstoque_receivables_alterar',
        'alterarVencimento': 'controleEstoque_receivables_alterarVencimento'
    };
    
    const permissionKey = permissionMap[permissionType];
    if (!permissionKey) return true; // Se não mapeado, permitir por padrão
    
    // Verificar permissão específica (padrão é true se não estiver definido como false)
    return userPermissionsData[permissionKey] !== false;
}

// Solicitar senha de autorização quando não tiver permissão
function requestAuthorizationPassword(permissionKey, actionName) {
    return new Promise((resolve) => {
        const password = prompt(`⚠️ Você não tem permissão para "${actionName}".\n\nDigite a senha de um usuário com permissão para autorizar esta ação:`);
        
        if (!password) {
            resolve(false);
            return;
        }
        
        // Verificar se existe um usuário com essa senha e com a permissão necessária
        const authorizedUser = users.find(user => {
            if (user.password !== password) return false;
            
            // Coutinho sempre autoriza
            if (user.username && user.username.toLowerCase() === 'coutinho') return true;
            
            // Administradores sempre autorizam
            if (user.accessLevel === 'admin') return true;
            
            // Verificar se o usuário tem a permissão específica
            const userPermissionsData = userPermissions[user.id] || {};
            return userPermissionsData[permissionKey] !== false;
        });
        
        if (authorizedUser) {
            alert(`✅ Ação autorizada por ${authorizedUser.name || authorizedUser.username}`);
            resolve(true);
        } else {
            alert('❌ Senha inválida ou usuário sem permissão para esta ação.');
            resolve(false);
        }
    });
}

function hasUserPermission(sectionKey) {
    if (!currentUser) return false;
    
    // Coutinho (super admin) sempre tem acesso total
    const isCoutinho = currentUser.username && currentUser.username.toLowerCase() === 'coutinho';
    if (isCoutinho) return true;
    
    // Administradores sempre têm permissão (mas podem ter restrições se não for Coutinho)
    if (currentUser.accessLevel === 'admin') return true;
    
    // Verificar permissões do usuário
    const userPermissionsData = userPermissions[currentUser.id] || {};
    
    // Se não houver permissões salvas, usar padrão (todas permitidas)
    if (Object.keys(userPermissionsData).length === 0) {
        return true;
    }
    
    // Mapear seções para chaves de permissão
    const sectionMap = {
        'sales': 'vender',
        'inventory': 'controleEstoque',
        'clients': 'controleEstoque_clientes',
        'products': 'controleEstoque_produtos',
        'brands': 'controleEstoque_brands',
        'categories': 'controleEstoque_categories',
        'suppliers': 'controleEstoque_suppliers',
        'entries': 'controleEstoque_entries',
        'exits': 'controleEstoque_exits',
        'receivables': 'controleEstoque_receivables',
        'reports': 'controleEstoque_reports',
        'inventory-settings': 'controleEstoque_settings',
        'more-options': 'maisOpcoes',
        'company': 'maisOpcoes_perfilEmpresa',
        'backup': 'maisOpcoes_backup',
        'restore': 'maisOpcoes_restore',
        'support': 'maisOpcoes_support',
        'license': 'maisOpcoes_license',
        'license-status': 'maisOpcoes_licenseStatus',
        'users': 'maisOpcoes_users',
        'system-log': 'maisOpcoes_systemLog',
        'settings': 'maisOpcoes_settings',
        'birthday-card-settings': 'maisOpcoes_birthdayCard',
        'button-settings': 'maisOpcoes_buttonSettings',
        'inactivity-timeout': 'maisOpcoes_inactivityTimeout'
    };
    
    const permissionKey = sectionMap[sectionKey];
    if (!permissionKey) return true; // Seção não mapeada, permitir por padrão
    
    // Verificar se a permissão principal está ativa (para sub-opções)
    if (permissionKey.startsWith('controleEstoque_')) {
        // Primeiro verificar se "Controle de Estoque" está ativo
        if (userPermissionsData.controleEstoque === false) {
            return false;
        }
        // Depois verificar a sub-opção específica
        return userPermissionsData[permissionKey] !== false;
    }
    
    if (permissionKey.startsWith('maisOpcoes_')) {
        // Primeiro verificar se "Mais Opções" está ativo
        if (userPermissionsData.maisOpcoes === false) {
            return false;
        }
        // Depois verificar a sub-opção específica
        return userPermissionsData[permissionKey] !== false;
    }
    
    return userPermissionsData[permissionKey] !== false;
}

// Carregar usuários no filtro de log
function loadUsersForLogFilter() {
    const userFilter = document.getElementById('log-filter-user');
    if (!userFilter) return;
    
    // Limpar opções existentes (exceto "Todos")
    userFilter.innerHTML = '<option value="">Todos os usuários</option>';
    
    // Adicionar usuários únicos dos logs
    const uniqueUsers = [...new Set(systemLogs.map(log => log.username))].sort();
    uniqueUsers.forEach(username => {
        const option = document.createElement('option');
        option.value = username;
        option.textContent = username;
        userFilter.appendChild(option);
    });
}

// ==========================================
// SISTEMA DE PERSONALIZAÇÃO DE TEMA POR USUÁRIO
// ==========================================

// Função para aplicar a cor do tema
function applyThemeColor(primaryColor, secondaryColor = null) {
    // Se não foi fornecida cor secundária, gerar automaticamente
    if (!secondaryColor) {
        secondaryColor = generateSecondaryColor(primaryColor);
    }
    
    // Aplicar as variáveis CSS
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.documentElement.style.setProperty('--secondary-color', secondaryColor);
    
    // Atualizar o preview do seletor de cor se existir
    const colorPreview = document.getElementById('color-preview');
    const colorPicker = document.getElementById('theme-color-picker');
    
    if (colorPreview) {
        colorPreview.textContent = primaryColor.toUpperCase();
    }
    
    if (colorPicker) {
        colorPicker.value = primaryColor;
    }
    
    console.log(`Tema aplicado: ${primaryColor} -> ${secondaryColor}`);
}

// Aplicar imagem de fundo (ou remover se não houver)
function applyThemeBackgroundImage(backgroundImage) {
    if (backgroundImage) {
        document.documentElement.style.setProperty('--background-image', `url('${backgroundImage}')`);
    } else {
        document.documentElement.style.setProperty('--background-image', 'none');
    }
}

// Função para aplicar tema padrão (antes do login)
function applyDefaultTheme() {
    const defaultPrimary = '#667eea';
    const defaultSecondary = '#764ba2';
    applyThemeColor(defaultPrimary, defaultSecondary);
    applyThemeBackgroundImage(null);
}

// Função para carregar tema do usuário logado
function loadUserTheme() {
    if (!currentUser || !currentUser.username) {
        applyDefaultTheme();
        return;
    }
    
    const userTheme = userThemeSettings[currentUser.username];
    if (userTheme && userTheme.primaryColor) {
        applyThemeColor(userTheme.primaryColor, userTheme.secondaryColor);
        applyThemeBackgroundImage(userTheme.backgroundImage || null);
        console.log(`Tema do usuário ${currentUser.username} carregado: ${userTheme.primaryColor}`);
    } else {
        // Se usuário não tem tema personalizado, aplicar padrão
        applyDefaultTheme();
    }
}

// Função para salvar tema do usuário
function saveUserTheme(primaryColor, secondaryColor) {
    if (!currentUser || !currentUser.username) {
        alert('❌ Erro: Usuário não está logado!');
        return;
    }
    
    // Salvar tema para o usuário atual (mantendo imagem de fundo, se já existir)
    userThemeSettings[currentUser.username] = {
        primaryColor: primaryColor,
        secondaryColor: secondaryColor,
        backgroundImage: userThemeSettings[currentUser.username]?.backgroundImage || null,
        lastUpdated: new Date().toISOString()
    };
    
    localStorage.setItem('userThemeSettings', JSON.stringify(userThemeSettings));
    console.log(`Tema salvo para usuário ${currentUser.username}: ${primaryColor} -> ${secondaryColor}`);
}

// Função para gerar cor secundária baseada na primária
function generateSecondaryColor(primaryColor) {
    // Converter hex para HSL
    const hsl = hexToHsl(primaryColor);
    
    // Ajustar matiz (+30 graus) e saturação (-10%) para criar harmonia
    let newHue = (hsl.h + 30) % 360;
    let newSat = Math.max(0, hsl.s - 10);
    let newLight = Math.max(10, hsl.l - 5); // Escurecer um pouco
    
    // Converter de volta para hex
    return hslToHex(newHue, newSat, newLight);
}

// Função para converter HEX para HSL
function hexToHsl(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

// Função para converter HSL para HEX
function hslToHex(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = (c) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Função chamada quando o usuário muda a cor (apenas atualiza o preview)
function updateColorPreview() {
    const colorPicker = document.getElementById('theme-color-picker');
    const colorPreview = document.getElementById('color-preview');
    
    if (colorPicker && colorPreview) {
        colorPreview.textContent = colorPicker.value.toUpperCase();
    }
}

// Função para salvar a cor selecionada
function saveThemeColor() {
    const colorPicker = document.getElementById('theme-color-picker');
    if (!colorPicker) return;
    
    if (!currentUser || !currentUser.username) {
        alert('❌ Erro: Você precisa estar logado para alterar o tema!');
        return;
    }
    
    const selectedColor = colorPicker.value;
    const secondaryColor = generateSecondaryColor(selectedColor);
    
    // Preparar objeto existente ou novo
    if (!userThemeSettings[currentUser.username]) {
        userThemeSettings[currentUser.username] = {
            primaryColor: selectedColor,
            secondaryColor: secondaryColor,
            backgroundImage: null,
            lastUpdated: new Date().toISOString()
        };
    }

    // Aplicar mudanças de cor
    userThemeSettings[currentUser.username].primaryColor = selectedColor;
    userThemeSettings[currentUser.username].secondaryColor = secondaryColor;

    // Se houver imagem pendente (inclusive null), aplicar também
    if (window._pendingThemeBackgroundImage !== undefined) {
        userThemeSettings[currentUser.username].backgroundImage = window._pendingThemeBackgroundImage;
    }

    userThemeSettings[currentUser.username].lastUpdated = new Date().toISOString();

    // Salvar em localStorage
    localStorage.setItem('userThemeSettings', JSON.stringify(userThemeSettings));

    // Aplicar tema completo imediatamente
    applyThemeColor(selectedColor, secondaryColor);
    applyThemeBackgroundImage(userThemeSettings[currentUser.username].backgroundImage || null);

    // Log da alteração
    addSystemLog('theme_change', `Cor do tema alterada para ${selectedColor}`, currentUser.username);

    alert(`✅ Tema personalizado salvo! Cor: ${selectedColor}\n\nO tema será mantido mesmo após fechar o navegador.`);
}

// Função para restaurar cor padrão
function resetThemeColor() {
    if (!currentUser || !currentUser.username) {
        alert('❌ Erro: Você precisa estar logado para alterar o tema!');
        return;
    }
    
    const defaultPrimary = '#667eea';
    const defaultSecondary = '#764ba2';
    
    // Atualizar o seletor de cor
    const colorPicker = document.getElementById('theme-color-picker');
    if (colorPicker) {
        colorPicker.value = defaultPrimary;
        updateColorPreview();
    }
    
    // Aplicar cores padrão
    applyThemeColor(defaultPrimary, defaultSecondary);
    
    // Remover tema personalizado do usuário
    if (userThemeSettings[currentUser.username]) {
        delete userThemeSettings[currentUser.username];
        localStorage.setItem('userThemeSettings', JSON.stringify(userThemeSettings));
    }
    
    // Log da restauração
    addSystemLog('theme_reset', 'Cor do tema restaurada para o padrão', currentUser.username);
    
    alert('✅ Cor do tema restaurada para o padrão!');
}

// Função para configurar eventos do seletor de cor
function setupThemeColorPicker() {
    const colorPicker = document.getElementById('theme-color-picker');
    if (colorPicker) {
        // Remover listeners antigos para evitar duplicação
        colorPicker.removeEventListener('input', updateColorPreview);
        colorPicker.removeEventListener('change', updateColorPreview);
        
        // Adicionar novos listeners apenas para preview
        colorPicker.addEventListener('input', updateColorPreview);
        colorPicker.addEventListener('change', updateColorPreview);
        
        // Definir valor inicial baseado no usuário logado
        if (currentUser && currentUser.username && userThemeSettings[currentUser.username]) {
            colorPicker.value = userThemeSettings[currentUser.username].primaryColor;
        } else {
            colorPicker.value = '#667eea';
        }
        
        // Atualizar preview inicial
        updateColorPreview();
    }
}

// ==================== FUNÇÕES DO CONTROLE DE ESTOQUE ====================

// Salvar produtos no localStorage
function saveProducts() {
    localStorage.setItem('products', JSON.stringify(products));
}

// Carregar produtos do localStorage
function loadProductsFromStorage() {
    products = JSON.parse(localStorage.getItem('products')) || [];
}

// Gerar ID único para produto
function generateProductId() {
    return 'product_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Formatar valor monetário
function formatCurrency(value) {
    if (!value && value !== 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Mostrar view do inventário
function showInventoryView(view, event) {
    // Verificar permissão antes de mostrar a view
    const viewToSectionMap = {
        'clients': 'clients',
        'products': 'products',
        'brands': 'brands',
        'categories': 'categories',
        'suppliers': 'suppliers',
        'entries': 'entries',
        'exits': 'exits',
        'receivables': 'receivables',
        'reports': 'reports',
        'settings': 'inventory-settings'
    };
    
    const sectionId = viewToSectionMap[view];
    if (sectionId === 'receivables') {
        // Para Contas a Receber, verificar permissão de visualizar
        if (!hasReceivablesPermission('visualizar')) {
            alert('Você não tem permissão para acessar Contas a Receber.');
            return;
        }
    } else if (sectionId && !hasUserPermission(sectionId)) {
        alert('Você não tem permissão para acessar esta opção.');
        return;
    }
    // Remover active de todos os botões
    document.querySelectorAll('.inventory-option-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Remover active de todas as views
    document.querySelectorAll('.inventory-view').forEach(v => {
        v.classList.remove('active');
    });
    
    // Ativar botão clicado (se houver evento)
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Se não houver evento, ativar o botão correspondente manualmente
        const btn = document.querySelector(`.inventory-option-btn[onclick*="'${view}'"]`);
        if (btn) {
            btn.classList.add('active');
        }
    }
    
    // Mostrar view correspondente
    const viewElement = document.getElementById(`inventory-${view}-view`);
    if (viewElement) {
        viewElement.classList.add('active');
    }
    
    // Carregar conteúdo específico de cada view
    if (view === 'products') {
        showProductsListView();
        populateProductBrandSelect(); // Popular select de marcas
        populateProductCategorySelect(); // Popular select de categorias
        populateProductSupplierSelect(); // Popular select de fornecedores
        loadProducts();
        updateInventoryProductsCount(); // Atualizar contador no botão
    } else if (view === 'clients') {
        showInventoryClientsListView();
        loadInventoryClients();
        updateInventoryClientsCount(); // Atualizar contador no botão
    } else if (view === 'brands') {
        showBrandsListView();
        loadBrands();
        updateInventoryBrandsCount(); // Atualizar contador no botão
        // Migrar dados na primeira vez
        migrateBrandsFromProducts();
    } else if (view === 'categories') {
        showCategoriesListView();
        loadCategories();
        updateInventoryCategoriesCount(); // Atualizar contador no botão
        // Migrar dados na primeira vez
        migrateCategoriesFromProducts();
    } else if (view === 'suppliers') {
        showSuppliersListView();
        loadSuppliers();
        updateInventorySuppliersCount(); // Atualizar contador no botão
    } else if (view === 'settings') {
        // Inicializar formas de pagamento e mostrar menu de configurações
        initializePaymentMethods();
        const settingsView = document.getElementById('inventory-settings-view');
        const paymentMethodsView = document.getElementById('payment-methods-view');
        if (settingsView) {
            const menu = settingsView.querySelector('.settings-menu');
            if (menu) menu.style.display = 'block';
        }
        if (paymentMethodsView) {
            paymentMethodsView.style.display = 'none';
        }
    } else if (view === 'exits') {
        loadSalesList();
    } else if (view === 'receivables') {
        loadReceivablesList();
    }
}

// Atualizar contador de clientes no botão lateral
function updateInventoryClientsCount() {
    const countBadge = document.getElementById('inventory-clients-count');
    if (countBadge) {
        countBadge.textContent = `[${clients.length}]`;
    }
}

// Atualizar contador de produtos no botão lateral
function updateInventoryProductsCount() {
    const countBadge = document.getElementById('inventory-products-count');
    if (countBadge) {
        countBadge.textContent = `[${products.length}]`;
    }
}

function updateInventoryBrandsCount() {
    const countBadge = document.getElementById('inventory-brands-count');
    if (countBadge) {
        countBadge.textContent = `[${brands.length}]`;
    }
}

function updateInventoryCategoriesCount() {
    const countBadge = document.getElementById('inventory-categories-count');
    if (countBadge) {
        countBadge.textContent = `[${categories.length}]`;
    }
}

// Atualizar contador de fornecedores no botão lateral
function updateInventorySuppliersCount() {
    const countBadge = document.getElementById('inventory-suppliers-count');
    if (countBadge) {
        countBadge.textContent = `[${suppliers.length}]`;
    }
}

// ============================================
// MÓDULO DE CATEGORIAS
// ============================================

let editingCategoryId = null;

// Migrar categorias existentes dos produtos
function migrateCategoriesFromProducts() {
    // Verificar se já foi migrado
    const migrationFlag = localStorage.getItem('categories_migrated');
    if (migrationFlag === 'true') return;
    
    // Coletar todas as categorias únicas dos produtos
    const uniqueCategories = new Set();
    products.forEach(product => {
        const categoria = product.categoria || '';
        if (categoria && categoria.trim() !== '' && categoria !== 'Diversos') {
            uniqueCategories.add(categoria.trim());
        }
    });
    
    // Criar registros de categoria para cada categoria única
    uniqueCategories.forEach(nomeCategoria => {
        // Verificar se já existe
        const exists = categories.find(c => c.nome_categoria.toLowerCase() === nomeCategoria.toLowerCase());
        if (!exists) {
            const newCategory = {
                id: Date.now() + Math.random(),
                nome_categoria: nomeCategoria,
                categoria_pai_id: null,
                descricao: '',
                status_ativo: true,
                createdAt: new Date().toISOString()
            };
            categories.push(newCategory);
        }
    });
    
    // Adicionar categoria padrão "Diversos" se não existir
    const diversosExists = categories.find(c => c.nome_categoria.toLowerCase() === 'diversos');
    if (!diversosExists) {
        const diversosCategory = {
            id: Date.now() + Math.random() + 1,
            nome_categoria: 'Diversos',
            categoria_pai_id: null,
            descricao: 'Categoria padrão para produtos sem categoria específica',
            status_ativo: true,
            createdAt: new Date().toISOString()
        };
        categories.push(diversosCategory);
    }
    
    // Salvar e marcar como migrado
    saveCategories();
    localStorage.setItem('categories_migrated', 'true');
    
    // Atualizar produtos para referenciar IDs
    updateProductsCategoryReferences();
}

// Atualizar produtos para usar referência de ID ao invés de nome
function updateProductsCategoryReferences() {
    let updated = false;
    products.forEach(product => {
        const categoriaNome = product.categoria || 'Diversos';
        if (!product.categoryId) {
            const category = categories.find(c => c.nome_categoria.toLowerCase() === categoriaNome.toLowerCase());
            if (category) {
                product.categoryId = category.id;
                product.categoria = category.nome_categoria; // Manter nome para compatibilidade
                updated = true;
            }
        }
    });
    
    if (updated) {
        saveProducts();
    }
}

// Salvar categorias no localStorage
function saveCategories() {
    try {
        localStorage.setItem('categories', JSON.stringify(categories));
    } catch (error) {
        console.error('Erro ao salvar categorias:', error);
        alert('Erro ao salvar categorias. Por favor, tente novamente.');
    }
}

// Carregar categorias do localStorage
function loadCategoriesFromStorage() {
    try {
        const stored = localStorage.getItem('categories');
        if (stored) {
            categories = JSON.parse(stored);
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        categories = [];
    }
}

// Mostrar lista de categorias
function showCategoriesListView() {
    document.getElementById('categories-list-view').classList.add('active');
    document.getElementById('categories-register-view').classList.remove('active');
    loadCategories();
}

// Mostrar formulário de cadastro
function showCategoriesRegisterView() {
    // SEMPRE limpar variáveis de edição ao abrir para cadastro
    editingCategoryId = null;
    document.getElementById('category-id').value = '';
    
    document.getElementById('categories-list-view').classList.remove('active');
    document.getElementById('categories-register-view').classList.add('active');
    resetCategoryForm();
    populateCategoryParentSelect();
    document.getElementById('category-form-title').textContent = 'Cadastrar Categoria';
}

// Resetar formulário
function resetCategoryForm() {
    document.getElementById('category-id').value = '';
    document.getElementById('category-nome').value = '';
    document.getElementById('category-pai-id').value = '';
    document.getElementById('category-descricao').value = '';
    document.getElementById('category-status-ativo').checked = true;
}

// Popular select de categoria pai
function populateCategoryParentSelect() {
    const select = document.getElementById('category-pai-id');
    if (!select) return;
    
    loadCategoriesFromStorage();
    
    // Salvar valor atual
    const currentValue = select.value;
    
    // Limpar e adicionar opção padrão
    select.innerHTML = '<option value="">Nenhuma (Categoria Principal)</option>';
    
    // Adicionar categorias ativas (exceto a atual se estiver editando)
    const activeCategories = categories.filter(c => {
        if (editingCategoryId && c.id == editingCategoryId) return false; // Não permitir selecionar a si mesma
        return c.status_ativo !== false;
    });
    
    activeCategories.sort((a, b) => a.nome_categoria.localeCompare(b.nome_categoria));
    
    activeCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.nome_categoria;
        select.appendChild(option);
    });
    
    // Restaurar valor se ainda existir
    if (currentValue) {
        const option = select.querySelector(`option[value="${currentValue}"]`);
        if (option) {
            select.value = currentValue;
        }
    }
}

// Carregar e exibir categorias
function loadCategories() {
    const container = document.getElementById('categories-list');
    if (!container) return;
    
    loadCategoriesFromStorage();
    
    // Aplicar filtros
    let filteredCategories = categories;
    
    // Filtro de pesquisa
    const searchInput = document.getElementById('category-search-input');
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = normalizeText(searchInput.value);
        filteredCategories = filteredCategories.filter(category => 
            normalizeText(category.nome_categoria).includes(searchTerm)
        );
    }
    
    // Limpar container
    container.innerHTML = '';
    
    if (filteredCategories.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Nenhuma categoria cadastrada.</p>';
        return;
    }
    
    // Criar cards
    filteredCategories.forEach(category => {
        const card = createCategoryCard(category);
        container.appendChild(card);
    });
}

// Criar card de categoria
function createCategoryCard(category) {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.onclick = () => editCategoryFromCard(category.id);
    
    // Buscar categoria pai se houver
    let hierarquiaHtml = '';
    if (category.categoria_pai_id) {
        const categoriaPai = categories.find(c => c.id == category.categoria_pai_id);
        if (categoriaPai) {
            hierarquiaHtml = `<div class="client-info" style="color: #666; font-style: italic;">
                <strong>Subcategoria de:</strong> ${categoriaPai.nome_categoria}
            </div>`;
        }
    }
    
    // Contar produtos nesta categoria
    const produtosCount = products.filter(p => {
        if (p.categoryId == category.id) return true;
        if (p.categoria && p.categoria.toLowerCase() === category.nome_categoria.toLowerCase()) return true;
        return false;
    }).length;
    
    const produtosHtml = `<div class="client-info">
        <strong>Produtos:</strong> ${produtosCount} produto(s)
    </div>`;
    
    const statusBadge = category.status_ativo !== false 
        ? '<span class="category-badge" style="background: #4caf50;">Ativa</span>'
        : '<span class="category-badge" style="background: #f44336;">Inativa</span>';
    
    card.innerHTML = `
        <div class="client-card-header">
            <h3>${category.nome_categoria} ${statusBadge}</h3>
        </div>
        ${hierarquiaHtml}
        ${produtosHtml}
        <div class="client-actions" onclick="event.stopPropagation()">
            <button class="btn btn-edit" onclick="editCategoryFromCard('${category.id}')">✏️ Editar</button>
            <button class="btn btn-delete" onclick="deleteCategoryFromCard('${category.id}')">🗑️ Excluir</button>
        </div>
    `;
    
    return card;
}

// Editar categoria a partir do card
function editCategoryFromCard(id) {
    const category = categories.find(c => c.id == id);
    if (!category) return;
    
    // Definir que está editando ANTES de mostrar a view
    editingCategoryId = id;
    document.getElementById('category-id').value = category.id;
    
    // Mostrar view sem limpar (não chamar showCategoriesRegisterView que limpa tudo)
    document.getElementById('categories-list-view').classList.remove('active');
    document.getElementById('categories-register-view').classList.add('active');
    
    // Preencher formulário
    document.getElementById('category-form-title').textContent = 'Editar Categoria';
    document.getElementById('category-nome').value = category.nome_categoria || '';
    document.getElementById('category-descricao').value = category.descricao || '';
    document.getElementById('category-status-ativo').checked = category.status_ativo !== false;
    
    // Popular select de categoria pai e definir valor
    populateCategoryParentSelect();
    if (category.categoria_pai_id) {
        document.getElementById('category-pai-id').value = category.categoria_pai_id;
    }
}

// Excluir categoria a partir do card
function deleteCategoryFromCard(id) {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
    
    // Verificar se há produtos usando esta categoria
    const productsUsingCategory = products.filter(p => {
        if (p.categoryId == id) return true;
        const category = categories.find(c => c.id == id);
        if (category && p.categoria && p.categoria.toLowerCase() === category.nome_categoria.toLowerCase()) return true;
        return false;
    });
    
    if (productsUsingCategory.length > 0) {
        if (!confirm(`Esta categoria está sendo usada por ${productsUsingCategory.length} produto(s). Deseja realmente excluir? Os produtos ficarão sem categoria.`)) {
            return;
        }
    }
    
    // Verificar se há subcategorias
    const subcategories = categories.filter(c => c.categoria_pai_id == id);
    if (subcategories.length > 0) {
        if (!confirm(`Esta categoria possui ${subcategories.length} subcategoria(s). Ao excluir, as subcategorias ficarão sem categoria pai. Deseja continuar?`)) {
            return;
        }
    }
    
    const index = categories.findIndex(c => c.id == id);
    if (index !== -1) {
        categories.splice(index, 1);
        saveCategories();
        loadCategories();
        updateInventoryCategoriesCount();
        alert('Categoria excluída com sucesso!');
    }
}

// Pesquisar categorias
function searchCategories() {
    loadCategories();
}

// Salvar categoria (criar ou editar)
function saveCategory() {
    const idInput = document.getElementById('category-id');
    const id = idInput ? idInput.value : '';
    const nomeCategoria = document.getElementById('category-nome').value.trim();
    
    if (!nomeCategoria) {
        alert('Por favor, informe o nome da categoria.');
        return;
    }
    
    if (nomeCategoria.length > 50) {
        alert('O nome da categoria deve ter no máximo 50 caracteres.');
        return;
    }
    
    // Verificar duplicatas (exceto a atual)
    const existingCategory = categories.find(c => 
        c.nome_categoria.toLowerCase() === nomeCategoria.toLowerCase() && 
        (!id || c.id != id)
    );
    
    if (existingCategory) {
        alert('Já existe uma categoria com este nome.');
        return;
    }
    
    const categoriaPaiId = document.getElementById('category-pai-id').value;
    
    // Verificar se está tentando criar uma hierarquia circular
    if (categoriaPaiId && id) {
        let currentParentId = categoriaPaiId;
        while (currentParentId) {
            if (currentParentId == id) {
                alert('Não é possível criar uma hierarquia circular. Uma categoria não pode ser pai de si mesma.');
                return;
            }
            const parentCategory = categories.find(c => c.id == currentParentId);
            if (!parentCategory) break;
            currentParentId = parentCategory.categoria_pai_id;
        }
    }
    
    const categoryData = {
        nome_categoria: nomeCategoria,
        categoria_pai_id: categoriaPaiId ? parseFloat(categoriaPaiId) : null,
        descricao: document.getElementById('category-descricao').value.trim(),
        status_ativo: document.getElementById('category-status-ativo').checked,
        updatedAt: new Date().toISOString()
    };
    
    if (id && editingCategoryId) {
        // Editar existente
        const index = categories.findIndex(c => c.id == id);
        if (index !== -1) {
            categoryData.id = categories[index].id;
            categoryData.createdAt = categories[index].createdAt || new Date().toISOString();
            categories[index] = categoryData;
        }
    } else {
        // Criar novo
        categoryData.id = Date.now();
        categoryData.createdAt = new Date().toISOString();
        categories.push(categoryData);
    }
    
    saveCategories();
    loadCategories();
    updateInventoryCategoriesCount();
    
    // Limpar TUDO após salvar para garantir que próximo cadastro seja novo
    editingCategoryId = null;
    document.getElementById('category-id').value = '';
    document.getElementById('category-form').reset();
    document.getElementById('category-form-title').textContent = 'Cadastrar Categoria';
    document.getElementById('category-status-ativo').checked = true;
    document.getElementById('category-pai-id').value = '';
    
    alert(id ? 'Categoria atualizada com sucesso!' : 'Categoria cadastrada com sucesso!');
    
    showCategoriesListView();
}

// ============================================
// MÓDULO DE MARCA/FABRICANTE
// ============================================

let editingBrandId = null;

// Migrar marcas/fabricantes existentes dos produtos
function migrateBrandsFromProducts() {
    // Verificar se já foi migrado
    const migrationFlag = localStorage.getItem('brands_migrated');
    if (migrationFlag === 'true') return;
    
    // Coletar todas as marcas únicas dos produtos
    const uniqueBrands = new Set();
    products.forEach(product => {
        const marca = product.marca || product.brand || '';
        if (marca && marca.trim() !== '' && marca !== 'Outras') {
            uniqueBrands.add(marca.trim());
        }
    });
    
    // Criar registros de marca para cada marca única
    uniqueBrands.forEach(nomeMarca => {
        // Verificar se já existe
        const exists = brands.find(b => b.nome_completo.toLowerCase() === nomeMarca.toLowerCase());
        if (!exists) {
            const newBrand = {
                id: Date.now() + Math.random(),
                nome_completo: nomeMarca,
                nome_fantasia: '',
                tipo_pessoa: '',
                identificador_fiscal: '',
                telefone_principal: '',
                email_principal: '',
                site_oficial: '',
                endereco_completo: '',
                cidade_estado_cep: '',
                contato_chave: '',
                condicoes_pagamento: '',
                prazo_entrega: '',
                status_ativo: true,
                createdAt: new Date().toISOString()
            };
            brands.push(newBrand);
        }
    });
    
    // Salvar e marcar como migrado
    saveBrands();
    localStorage.setItem('brands_migrated', 'true');
    
    // Atualizar produtos para referenciar IDs
    updateProductsBrandReferences();
}

// Atualizar produtos para usar referência de ID ao invés de nome
function updateProductsBrandReferences() {
    let updated = false;
    products.forEach(product => {
        const marcaNome = product.marca || product.brand || '';
        if (marcaNome && marcaNome !== 'Outras' && !product.brandId) {
            const brand = brands.find(b => b.nome_completo.toLowerCase() === marcaNome.toLowerCase());
            if (brand) {
                product.brandId = brand.id;
                product.marca = brand.nome_completo; // Manter nome para compatibilidade
                updated = true;
            }
        }
    });
    
    if (updated) {
        saveProducts();
    }
}

// Salvar marcas no localStorage
function saveBrands() {
    try {
        localStorage.setItem('brands', JSON.stringify(brands));
    } catch (error) {
        console.error('Erro ao salvar marcas:', error);
        alert('Erro ao salvar marcas/fabricantes. Por favor, tente novamente.');
    }
}

// Carregar marcas do localStorage
function loadBrandsFromStorage() {
    try {
        const stored = localStorage.getItem('brands');
        if (stored) {
            brands = JSON.parse(stored);
        }
    } catch (error) {
        console.error('Erro ao carregar marcas:', error);
        brands = [];
    }
}

// Mostrar lista de marcas
function showBrandsListView() {
    document.getElementById('brands-list-view').classList.add('active');
    document.getElementById('brands-register-view').classList.remove('active');
    loadBrands();
}

// Mostrar formulário de cadastro
function showBrandsRegisterView() {
    // SEMPRE limpar variáveis de edição ao abrir para cadastro
    editingBrandId = null;
    document.getElementById('brand-id').value = '';
    
    document.getElementById('brands-list-view').classList.remove('active');
    document.getElementById('brands-register-view').classList.add('active');
    resetBrandForm();
    document.getElementById('brand-form-title').textContent = 'Cadastrar Marca/Fabricante';
}

// Resetar formulário
function resetBrandForm() {
    document.getElementById('brand-id').value = '';
    document.getElementById('brand-nome-completo').value = '';
    document.getElementById('brand-nome-fantasia').value = '';
    document.getElementById('brand-tipo-pessoa').value = '';
    document.getElementById('brand-identificador-fiscal').value = '';
    document.getElementById('brand-telefone-principal').value = '';
    document.getElementById('brand-email-principal').value = '';
    document.getElementById('brand-site-oficial').value = '';
    document.getElementById('brand-endereco-completo').value = '';
    document.getElementById('brand-cidade-estado-cep').value = '';
    document.getElementById('brand-contato-chave').value = '';
    document.getElementById('brand-condicoes-pagamento').value = '';
    document.getElementById('brand-prazo-entrega').value = '';
    document.getElementById('brand-status-ativo').checked = true;
}

// Carregar e exibir marcas
function loadBrands() {
    const container = document.getElementById('brands-list');
    if (!container) return;
    
    loadBrandsFromStorage();
    
    // Aplicar filtros
    let filteredBrands = brands;
    
    // Filtro de pesquisa
    const searchInput = document.getElementById('brand-search-input');
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = normalizeText(searchInput.value);
        filteredBrands = filteredBrands.filter(brand => 
            normalizeText(brand.nome_completo).includes(searchTerm) ||
            normalizeText(brand.nome_fantasia).includes(searchTerm)
        );
    }
    
    // Limpar container
    container.innerHTML = '';
    
    if (filteredBrands.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Nenhuma marca/fabricante cadastrada.</p>';
        return;
    }
    
    // Criar cards
    filteredBrands.forEach(brand => {
        const card = createBrandCard(brand);
        container.appendChild(card);
    });
}

// Criar card de marca/fabricante
function createBrandCard(brand) {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.onclick = () => editBrandFromCard(brand.id);
    
    // Formatar identificador fiscal
    let identificadorHtml = '';
    if (brand.tipo_pessoa && brand.identificador_fiscal) {
        let formattedId = brand.identificador_fiscal;
        
        // Formatar CNPJ
        if (brand.tipo_pessoa === 'CNPJ' && formattedId.length === 14) {
            formattedId = formattedId.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
        }
        // Formatar CPF
        else if (brand.tipo_pessoa === 'CPF' && formattedId.length === 11) {
            formattedId = formattedId.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
        }
        
        identificadorHtml = `<div class="client-info"><strong>${brand.tipo_pessoa}:</strong> ${formattedId}</div>`;
    }
    
    // Link do site oficial
    let siteHtml = '';
    if (brand.site_oficial) {
        let siteUrl = brand.site_oficial.trim();
        // Adicionar https:// se não tiver protocolo
        if (siteUrl && !siteUrl.match(/^https?:\/\//)) {
            siteUrl = 'https://' + siteUrl;
        }
        siteHtml = `<div class="client-info">
            <a href="${siteUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color: #66e8ea; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                🌐 Site Oficial
            </a>
        </div>`;
    }
    
    const telefoneHtml = brand.telefone_principal 
        ? `<div class="client-info"><strong>Telefone:</strong> ${brand.telefone_principal}</div>`
        : '';
    
    const statusBadge = brand.status_ativo !== false 
        ? '<span class="category-badge" style="background: #4caf50;">Ativo</span>'
        : '<span class="category-badge" style="background: #f44336;">Inativo</span>';
    
    card.innerHTML = `
        <div class="client-card-header">
            <h3>${brand.nome_completo} ${statusBadge}</h3>
        </div>
        ${identificadorHtml}
        ${telefoneHtml}
        ${siteHtml}
        <div class="client-actions" onclick="event.stopPropagation()">
            <button class="btn btn-edit" onclick="editBrandFromCard('${brand.id}')">✏️ Editar</button>
            <button class="btn btn-delete" onclick="deleteBrandFromCard('${brand.id}')">🗑️ Excluir</button>
        </div>
    `;
    
    return card;
}

// Editar marca a partir do card
function editBrandFromCard(id) {
    const brand = brands.find(b => b.id == id);
    if (!brand) return;
    
    // Definir que está editando ANTES de mostrar a view
    editingBrandId = id;
    document.getElementById('brand-id').value = brand.id;
    
    // Mostrar view sem limpar (não chamar showBrandsRegisterView que limpa tudo)
    document.getElementById('brands-list-view').classList.remove('active');
    document.getElementById('brands-register-view').classList.add('active');
    
    // Preencher formulário
    document.getElementById('brand-form-title').textContent = 'Editar Marca/Fabricante';
    document.getElementById('brand-nome-completo').value = brand.nome_completo || '';
    document.getElementById('brand-nome-fantasia').value = brand.nome_fantasia || '';
    document.getElementById('brand-tipo-pessoa').value = brand.tipo_pessoa || '';
    document.getElementById('brand-identificador-fiscal').value = brand.identificador_fiscal || '';
    document.getElementById('brand-telefone-principal').value = brand.telefone_principal || '';
    document.getElementById('brand-email-principal').value = brand.email_principal || '';
    document.getElementById('brand-site-oficial').value = brand.site_oficial || '';
    document.getElementById('brand-endereco-completo').value = brand.endereco_completo || '';
    document.getElementById('brand-cidade-estado-cep').value = brand.cidade_estado_cep || '';
    document.getElementById('brand-contato-chave').value = brand.contato_chave || '';
    document.getElementById('brand-condicoes-pagamento').value = brand.condicoes_pagamento || '';
    document.getElementById('brand-prazo-entrega').value = brand.prazo_entrega || '';
    document.getElementById('brand-status-ativo').checked = brand.status_ativo !== false;
}

// Excluir marca a partir do card
function deleteBrandFromCard(id) {
    if (!confirm('Tem certeza que deseja excluir esta marca/fabricante?')) return;
    
    // Verificar se há produtos usando esta marca
    const productsUsingBrand = products.filter(p => p.brandId == id || (p.marca && brands.find(b => b.id == id && b.nome_completo === p.marca)));
    if (productsUsingBrand.length > 0) {
        if (!confirm(`Esta marca está sendo usada por ${productsUsingBrand.length} produto(s). Deseja realmente excluir? Os produtos ficarão sem marca.`)) {
            return;
        }
    }
    
    const index = brands.findIndex(b => b.id == id);
    if (index !== -1) {
        brands.splice(index, 1);
        saveBrands();
        loadBrands();
        updateInventoryBrandsCount();
        alert('Marca/fabricante excluída com sucesso!');
    }
}

// Pesquisar marcas
function searchBrands() {
    loadBrands();
}

// Salvar marca (criar ou editar)
function saveBrand() {
    const idInput = document.getElementById('brand-id');
    const id = idInput ? idInput.value : '';
    const nomeCompleto = document.getElementById('brand-nome-completo').value.trim();
    
    if (!nomeCompleto) {
        alert('Por favor, informe o nome completo da marca/fabricante.');
        return;
    }
    
    // Verificar duplicatas (exceto a atual)
    const existingBrand = brands.find(b => 
        b.nome_completo.toLowerCase() === nomeCompleto.toLowerCase() && 
        (!id || b.id != id)
    );
    
    if (existingBrand) {
        alert('Já existe uma marca/fabricante com este nome.');
        return;
    }
    
    // Processar site oficial (remover http:// ou https://)
    let siteOficial = document.getElementById('brand-site-oficial').value.trim();
    if (siteOficial) {
        siteOficial = siteOficial.replace(/^https?:\/\//, '').replace(/^www\./, '');
    }
    
    const brandData = {
        nome_completo: nomeCompleto,
        nome_fantasia: document.getElementById('brand-nome-fantasia').value.trim(),
        tipo_pessoa: document.getElementById('brand-tipo-pessoa').value,
        identificador_fiscal: document.getElementById('brand-identificador-fiscal').value.trim(),
        telefone_principal: document.getElementById('brand-telefone-principal').value.trim(),
        email_principal: document.getElementById('brand-email-principal').value.trim(),
        site_oficial: siteOficial,
        endereco_completo: document.getElementById('brand-endereco-completo').value.trim(),
        cidade_estado_cep: document.getElementById('brand-cidade-estado-cep').value.trim(),
        contato_chave: document.getElementById('brand-contato-chave').value.trim(),
        condicoes_pagamento: document.getElementById('brand-condicoes-pagamento').value.trim(),
        prazo_entrega: document.getElementById('brand-prazo-entrega').value.trim(),
        status_ativo: document.getElementById('brand-status-ativo').checked,
        updatedAt: new Date().toISOString()
    };
    
    if (id && editingBrandId) {
        // Editar existente
        const index = brands.findIndex(b => b.id == id);
        if (index !== -1) {
            brandData.id = brands[index].id;
            brandData.createdAt = brands[index].createdAt || new Date().toISOString();
            brands[index] = brandData;
        }
    } else {
        // Criar novo
        brandData.id = Date.now();
        brandData.createdAt = new Date().toISOString();
        brands.push(brandData);
    }
    
    saveBrands();
    loadBrands();
    updateInventoryBrandsCount();
    
    // Limpar TUDO após salvar para garantir que próximo cadastro seja novo
    editingBrandId = null;
    document.getElementById('brand-id').value = '';
    document.getElementById('brand-form').reset();
    document.getElementById('brand-form-title').textContent = 'Cadastrar Marca/Fabricante';
    document.getElementById('brand-status-ativo').checked = true;
    
    alert(id ? 'Marca/fabricante atualizada com sucesso!' : 'Marca/fabricante cadastrada com sucesso!');
    
    showBrandsListView();
}

// Mostrar lista de produtos
function showProductsListView() {
    const listView = document.getElementById('products-list-view');
    const registerView = document.getElementById('products-register-view');
    if (listView) listView.classList.add('active');
    if (registerView) registerView.classList.remove('active');
    loadProducts();
}

// Mostrar formulário de cadastro/edição
function showProductsRegisterView() {
    // SEMPRE limpar variáveis de edição ao abrir para cadastro
    editingProductId = null;
    document.getElementById('product-id').value = '';
    
    const listView = document.getElementById('products-list-view');
    const registerView = document.getElementById('products-register-view');
    if (listView) listView.classList.remove('active');
    if (registerView) registerView.classList.add('active');
    
    // Sempre resetar o formulário para garantir que é um novo cadastro
    resetProductForm();
    document.getElementById('product-form-title').textContent = 'Cadastrar Novo Produto';
}

// Resetar formulário de produto
function resetProductForm() {
    document.getElementById('product-form').reset();
    populateProductCategorySelect();
    document.getElementById('product-category-other-group').style.display = 'none';
    document.getElementById('product-id').value = '';
    document.getElementById('product-form-title').textContent = 'Cadastrar Novo Produto';
    document.getElementById('product-image-preview').style.display = 'none';
    document.getElementById('remove-product-image-btn').style.display = 'none';
    editingProductId = null;
    
    // Resetar select de marca
    populateProductBrandSelect();
    document.getElementById('product-brand').value = '';
    document.getElementById('product-brand-other-group').style.display = 'none';
    
    // Resetar select de categoria
    populateProductCategorySelect();
    document.getElementById('product-category').value = '';
    document.getElementById('product-category-other-group').style.display = 'none';
    
    // Resetar select de fornecedor
    populateProductSupplierSelect();
    document.getElementById('product-supplier').value = '';
    document.getElementById('product-supplier-other-group').style.display = 'none';
}

// Carregar e exibir produtos
function loadProducts() {
    const container = document.getElementById('products-list');
    if (!container) return;
    
    loadProductsFromStorage();
    
    // Aplicar filtros
    let filteredProducts = products;
    
    // Filtro de pesquisa
    const searchQuery = document.getElementById('product-search-input')?.value.toLowerCase() || '';
    if (searchQuery) {
        filteredProducts = filteredProducts.filter(p => 
            p.nome.toLowerCase().includes(searchQuery)
        );
    }
    
    // Filtro de categoria
    const categoryFilter = document.getElementById('product-category-filter')?.value || '';
    if (categoryFilter) {
        filteredProducts = filteredProducts.filter(p => p.categoria === categoryFilter);
    }
    
    // Limpar container
    container.innerHTML = '';
    
    if (filteredProducts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum produto cadastrado</h3>
                <p>Comece cadastrando seu primeiro produto!</p>
            </div>
        `;
        return;
    }
    
    // Popular filtro de categorias
    populateCategoryFilter();
    
    // Criar cards
    filteredProducts.forEach(product => {
        const card = createProductCard(product);
        container.appendChild(card);
    });
}

// Criar card de produto
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.onclick = () => editProductFromCard(product.id);
    
    const photoHtml = product.imagem 
        ? `<img src="${product.imagem}" alt="${product.nome}" class="client-photo" style="max-width: 100px; max-height: 100px; object-fit: cover;">`
        : '<div class="client-photo" style="background: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 24px; width: 100px; height: 100px;">📦</div>';
    
    const costHtml = product.custo 
        ? `<div class="client-info"><strong>Custo:</strong> ${formatCurrency(product.custo)}</div>`
        : '<div class="client-info"><strong>Custo:</strong> Não informado</div>';
    
    const stockClass = product.quantidadeEstoque < 10 ? 'low-stock' : '';
    const categoryBadge = product.categoria && product.categoria !== 'Diversos'
        ? `<span class="category-badge">${product.categoria}</span>`
        : '';
    
    card.innerHTML = `
        <div class="client-card-header">
            ${photoHtml}
            <h3>${product.nome} ${categoryBadge}</h3>
        </div>
        ${costHtml}
        <div class="client-info"><strong>Venda:</strong> ${formatCurrency(product.precoVenda)}</div>
        <div class="client-info ${stockClass}"><strong>Estoque:</strong> ${product.quantidadeEstoque || 0} unidades</div>
        <div class="client-actions" onclick="event.stopPropagation()">
            <button class="btn btn-edit" onclick="editProductFromCard('${product.id}')">✏️ Editar</button>
            <button class="btn btn-delete" onclick="deleteProductFromCard('${product.id}')">🗑️ Excluir</button>
        </div>
    `;
    
    return card;
}

// Popular filtro de categorias
function populateCategoryFilter() {
    const filter = document.getElementById('product-category-filter');
    if (!filter) return;
    
    const currentValue = filter.value;
    const categories = [...new Set(products.map(p => p.categoria || 'Diversos'))].sort();
    
    filter.innerHTML = '<option value="">Todas as Categorias</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        filter.appendChild(option);
    });
    
    if (currentValue) {
        filter.value = currentValue;
    }
}

// Pesquisar produtos
function searchProducts() {
    loadProducts();
}

// Filtrar produtos por categoria
function filterProductsByCategory() {
    loadProducts();
}

// Abrir modal de detalhes do produto
function openProductDetailsModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    selectedProductId = productId;
    
    document.getElementById('product-details-name').textContent = product.nome;
    
    const imagePreview = document.getElementById('product-details-image');
    const imagePlaceholder = document.getElementById('product-details-image-placeholder');
    const changeBtn = document.getElementById('change-product-image-btn');
    const removeBtn = document.getElementById('remove-product-image-modal-btn');
    
    if (product.imagem) {
        imagePreview.src = product.imagem;
        imagePreview.style.display = 'block';
        imagePlaceholder.style.display = 'none';
        changeBtn.style.display = 'block';
        removeBtn.style.display = 'block';
    } else {
        imagePreview.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
        changeBtn.style.display = 'none';
        removeBtn.style.display = 'none';
    }
    
    document.getElementById('product-details-modal').style.display = 'block';
}

// Fechar modal de detalhes
function closeProductDetailsModal() {
    document.getElementById('product-details-modal').style.display = 'none';
    selectedProductId = null;
}

// Editar produto a partir do modal
function editProductFromModal() {
    if (!selectedProductId) return;
    
    closeProductDetailsModal();
    openEditProductModal(selectedProductId);
}

// Abrir modal de edição
function openEditProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    editingProductId = productId;
    document.getElementById('product-id').value = product.id;
    
    // Preencher formulário
    document.getElementById('product-name').value = product.nome || '';
    document.getElementById('product-sku').value = product.sku || '';
    document.getElementById('product-barcode').value = product.codigoBarras || '';
    document.getElementById('product-cost').value = product.custo || '';
    document.getElementById('product-sale-price').value = product.precoVenda || '';
    document.getElementById('product-ncm').value = product.ncm || '';
    document.getElementById('product-stock').value = product.quantidadeEstoque || 0;
    document.getElementById('product-weight').value = product.peso || '';
    document.getElementById('product-height').value = product.altura || '';
    document.getElementById('product-width').value = product.largura || '';
    document.getElementById('product-length').value = product.comprimento || '';
    document.getElementById('product-description').value = product.descricao || '';
    // Popular select de categorias antes de definir valor
    populateProductCategorySelect();
    
    // Popular select de fornecedores antes de definir valor
    populateProductSupplierSelect();
    
    // Definir categoria do produto
    if (product.categoryId) {
        // Buscar categoria pelo ID
        const category = categories.find(c => c.id == product.categoryId);
        if (category) {
            document.getElementById('product-category').value = category.nome_categoria;
        } else {
            document.getElementById('product-category').value = product.categoria || 'Diversos';
        }
    } else {
        document.getElementById('product-category').value = product.categoria || 'Diversos';
    }
    
    // Verificar se precisa mostrar campo "Outras"
    if (product.categoria && !document.querySelector(`#product-category option[value="${product.categoria}"]`)) {
        document.getElementById('product-category').value = 'Outras';
        document.getElementById('product-category-other').value = product.categoria;
        document.getElementById('product-category-other-group').style.display = 'block';
    }
    
    // Popular select de marcas antes de definir valor
    populateProductBrandSelect();
    
    // Definir marca do produto
    if (product.brandId) {
        // Buscar marca pelo ID
        const brand = brands.find(b => b.id == product.brandId);
        if (brand) {
            document.getElementById('product-brand').value = brand.nome_completo;
        } else {
            document.getElementById('product-brand').value = product.marca || '';
        }
    } else {
        document.getElementById('product-brand').value = product.marca || '';
    }
    
    // Verificar se precisa mostrar campo "Outras"
    if (product.marca && !document.querySelector(`#product-brand option[value="${product.marca}"]`)) {
        document.getElementById('product-brand').value = 'Outras';
        document.getElementById('product-brand-other').value = product.marca;
        document.getElementById('product-brand-other-group').style.display = 'block';
    }
    
    // Imagem
    const preview = document.getElementById('product-image-preview');
    const removeBtn = document.getElementById('remove-product-image-btn');
    if (product.imagem) {
        preview.src = product.imagem;
        preview.style.display = 'block';
        removeBtn.style.display = 'block';
    } else {
        preview.style.display = 'none';
        removeBtn.style.display = 'none';
    }
    
    // Verificar se marca é "Outras"
    if (product.marca && !document.querySelector(`#product-brand option[value="${product.marca}"]`)) {
        document.getElementById('product-brand').value = 'Outras';
        document.getElementById('product-brand-other').value = product.marca;
        document.getElementById('product-brand-other-group').style.display = 'block';
    }
    
    // Definir fornecedor do produto
    if (product.supplierId) {
        // Buscar fornecedor pelo ID
        const supplier = suppliers.find(s => s.id == product.supplierId);
        if (supplier) {
            const displayName = supplier.nome || supplier.nomeFantasia || '';
            document.getElementById('product-supplier').value = displayName;
        } else {
            // Se não encontrar pelo ID, tentar pelo nome
            if (product.fornecedor) {
                const supplierOption = document.querySelector(`#product-supplier option[value="${product.fornecedor}"]`);
                if (supplierOption) {
                    document.getElementById('product-supplier').value = product.fornecedor;
                } else {
                    // Se não encontrar, usar "Outro (Novo Fornecedor)"
                    document.getElementById('product-supplier').value = 'Outro (Novo Fornecedor)';
                    document.getElementById('product-supplier-other').value = product.fornecedor;
                    document.getElementById('product-supplier-other-group').style.display = 'block';
                }
            }
        }
    } else if (product.fornecedor) {
        const supplierOption = document.querySelector(`#product-supplier option[value="${product.fornecedor}"]`);
        if (supplierOption) {
            document.getElementById('product-supplier').value = product.fornecedor;
        } else {
            // Se não encontrar, usar "Outro (Novo Fornecedor)"
            document.getElementById('product-supplier').value = 'Outro (Novo Fornecedor)';
            document.getElementById('product-supplier-other').value = product.fornecedor;
            document.getElementById('product-supplier-other-group').style.display = 'block';
        }
    }
    
    // Garantir que estamos na seção de inventário
    const inventorySection = document.getElementById('inventory');
    if (!inventorySection || !inventorySection.classList.contains('active')) {
        // Navegar para a seção de inventário primeiro
        showSection('inventory');
    }
    
    // Garantir que estamos na view de produtos do inventário
    const inventoryProductsView = document.getElementById('inventory-products-view');
    if (!inventoryProductsView || !inventoryProductsView.classList.contains('active')) {
        // Se não estiver na view de produtos, mudar para ela primeiro
        showInventoryView('products');
        // Aguardar um pouco para garantir que a view foi carregada
        setTimeout(() => {
            // Mostrar view sem limpar (não chamar showProductsRegisterView que limpa tudo)
            document.getElementById('products-list-view').classList.remove('active');
            document.getElementById('products-register-view').classList.add('active');
            document.getElementById('product-form-title').textContent = 'Editar Produto';
        }, 200);
    } else {
        // Já está na view correta, apenas mostrar o formulário sem limpar
        document.getElementById('products-list-view').classList.remove('active');
        document.getElementById('products-register-view').classList.add('active');
        document.getElementById('product-form-title').textContent = 'Editar Produto';
    }
}

// Alterar quantidade em estoque a partir do modal
function alterProductStockFromModal() {
    if (!selectedProductId) return;
    
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    
    document.getElementById('product-stock-id').value = selectedProductId;
    document.getElementById('product-stock-current').value = product.quantidadeEstoque || 0;
    document.getElementById('product-stock-new').value = product.quantidadeEstoque || 0;
    
    document.getElementById('product-stock-modal').style.display = 'block';
}

// Fechar modal de estoque
function closeProductStockModal() {
    document.getElementById('product-stock-modal').style.display = 'none';
    document.getElementById('product-stock-form').reset();
}

// Excluir produto a partir do modal
function deleteProductFromModal() {
    if (!selectedProductId) return;
    
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        deleteProduct(selectedProductId);
        closeProductDetailsModal();
    }
}

// Excluir produto
function deleteProduct(productId) {
    products = products.filter(p => p.id !== productId);
    saveProducts();
    updateInventoryProductsCount(); // Atualizar contador no botão
    autoSave(); // Salvamento automático
    loadProducts();
    
    // Adicionar log
    addSystemLog('delete_product', `Produto excluído: ${productId}`, currentUser ? currentUser.username : 'Sistema');
    
    alert('Produto excluído com sucesso!');
}

// Processar formulário de produto
function handleProductSubmit(event) {
    event.preventDefault();
    
    const productId = document.getElementById('product-id').value;
    const isEditing = !!productId;
    
    // Validar campos obrigatórios
    const nome = document.getElementById('product-name').value.trim();
    const precoVenda = parseFloat(document.getElementById('product-sale-price').value);
    const codigoBarras = document.getElementById('product-barcode').value.trim();
    const quantidadeEstoqueInput = document.getElementById('product-stock').value;
    const quantidadeEstoque = quantidadeEstoqueInput !== '' ? parseInt(quantidadeEstoqueInput) : null;
    const fornecedor = document.getElementById('product-supplier').value;
    
    if (!nome) {
        alert('Por favor, preencha o nome do produto.');
        return;
    }
    
    if (!precoVenda || precoVenda <= 0) {
        alert('Por favor, informe um preço de venda válido maior que zero.');
        return;
    }
    
    if (!codigoBarras) {
        alert('Por favor, preencha o código de barras (EAN/UPC).');
        return;
    }
    
    if (quantidadeEstoque === null || quantidadeEstoque < 0) {
        alert('Por favor, informe a quantidade em estoque (valor maior ou igual a zero).');
        return;
    }
    
    if (!fornecedor) {
        alert('Por favor, selecione um fornecedor.');
        return;
    }
    
    // Obter valores
    const sku = document.getElementById('product-sku').value.trim();
    const custo = document.getElementById('product-cost').value ? parseFloat(document.getElementById('product-cost').value) : null;
    const ncm = document.getElementById('product-ncm').value.trim();
    const peso = document.getElementById('product-weight').value ? parseFloat(document.getElementById('product-weight').value) : null;
    const altura = document.getElementById('product-height').value ? parseFloat(document.getElementById('product-height').value) : null;
    const largura = document.getElementById('product-width').value ? parseFloat(document.getElementById('product-width').value) : null;
    const comprimento = document.getElementById('product-length').value ? parseFloat(document.getElementById('product-length').value) : null;
    const descricao = document.getElementById('product-description').value.trim();
    let categoria = document.getElementById('product-category').value || 'Diversos';
    let categoryId = null;
    let marca = document.getElementById('product-brand').value || '';
    let brandId = null;
    
    // Se categoria for "Outras", pegar do campo de texto e criar automaticamente
    if (categoria === 'Outras') {
        categoria = document.getElementById('product-category-other').value.trim() || 'Diversos';
        if (categoria && categoria !== 'Diversos') {
            // Verificar se a categoria já existe
            loadCategoriesFromStorage();
            let existingCategory = categories.find(c => c.nome_categoria.toLowerCase() === categoria.toLowerCase());
            
            if (!existingCategory) {
                // Criar nova categoria automaticamente
                const newCategory = {
                    id: Date.now(),
                    nome_categoria: categoria,
                    categoria_pai_id: null,
                    descricao: '',
                    status_ativo: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                categories.push(newCategory);
                saveCategories();
                updateInventoryCategoriesCount();
                existingCategory = newCategory;
            }
            
            categoryId = existingCategory.id;
        }
    } else if (categoria) {
        // Buscar ID da categoria selecionada
        const categorySelect = document.getElementById('product-category');
        const selectedOption = categorySelect.querySelector(`option[value="${categoria}"]`);
        if (selectedOption && selectedOption.dataset.categoryId) {
            categoryId = parseFloat(selectedOption.dataset.categoryId);
        }
    }
    
    if (!categoria || categoria === '') {
        categoria = 'Diversos';
    }
    
    // Se marca for "Outras", pegar do campo de texto e criar automaticamente
    if (marca === 'Outras') {
        marca = document.getElementById('product-brand-other').value.trim() || '';
        if (marca) {
            // Verificar se a marca já existe
            loadBrandsFromStorage();
            let existingBrand = brands.find(b => b.nome_completo.toLowerCase() === marca.toLowerCase());
            
            if (!existingBrand) {
                // Criar nova marca automaticamente
                const newBrand = {
                    id: Date.now(),
                    nome_completo: marca,
                    nome_fantasia: '',
                    tipo_pessoa: '',
                    identificador_fiscal: '',
                    telefone_principal: '',
                    email_principal: '',
                    site_oficial: '',
                    endereco_completo: '',
                    cidade_estado_cep: '',
                    contato_chave: '',
                    condicoes_pagamento: '',
                    prazo_entrega: '',
                    status_ativo: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                brands.push(newBrand);
                saveBrands();
                updateInventoryBrandsCount();
                existingBrand = newBrand;
            }
            
            brandId = existingBrand.id;
        }
    } else if (marca) {
        // Buscar ID da marca selecionada
        const brandSelect = document.getElementById('product-brand');
        const selectedOption = brandSelect.querySelector(`option[value="${marca}"]`);
        if (selectedOption && selectedOption.dataset.brandId) {
            brandId = parseFloat(selectedOption.dataset.brandId);
        }
    }
    
    // Processar fornecedor
    let fornecedorNome = fornecedor;
    let supplierId = null;
    
    // Se fornecedor for "Outro (Novo Fornecedor)", pegar do campo de texto e criar automaticamente
    if (fornecedor === 'Outro (Novo Fornecedor)') {
        fornecedorNome = document.getElementById('product-supplier-other').value.trim();
        if (!fornecedorNome) {
            alert('Por favor, informe o nome do novo fornecedor.');
            return;
        }
        
        // Verificar se o fornecedor já existe
        loadSuppliersFromStorage();
        let existingSupplier = suppliers.find(s => {
            const nome = s.nome || s.nomeFantasia || '';
            return nome.toLowerCase() === fornecedorNome.toLowerCase();
        });
        
        if (!existingSupplier) {
            // Criar novo fornecedor automaticamente
            const newSupplier = {
                id: generateSupplierId(),
                nome: fornecedorNome,
                nomeFantasia: fornecedorNome,
                tipoPessoa: '',
                documento: '',
                inscricaoEstadual: '',
                telefone: '',
                email: '',
                cep: '',
                endereco: '',
                cidade: '',
                estado: '',
                banco: '',
                agencia: '',
                conta: '',
                pix: '',
                condicoesPagamento: '',
                categoria: '',
                situacao: 'Ativo',
                observacoes: '',
                logo: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            suppliers.push(newSupplier);
            saveSuppliers();
            updateInventorySuppliersCount();
            existingSupplier = newSupplier;
        }
        
        supplierId = existingSupplier.id;
        fornecedorNome = existingSupplier.nome || existingSupplier.nomeFantasia || fornecedorNome;
    } else if (fornecedor) {
        // Buscar ID do fornecedor selecionado
        const supplierSelect = document.getElementById('product-supplier');
        const selectedOption = supplierSelect.querySelector(`option[value="${fornecedor}"]`);
        if (selectedOption && selectedOption.dataset.supplierId) {
            supplierId = parseFloat(selectedOption.dataset.supplierId);
        }
    }
    
    // Obter imagem (se houver preview)
    const imagePreview = document.getElementById('product-image-preview');
    const imagem = imagePreview.style.display !== 'none' ? imagePreview.src : '';
    
    const productData = {
        id: isEditing ? productId : generateProductId(),
        nome,
        sku: sku || '',
        codigoBarras: codigoBarras || '',
        custo: custo || null,
        precoVenda,
        ncm: ncm || '',
        quantidadeEstoque,
        peso: peso || null,
        altura: altura || null,
        largura: largura || null,
        comprimento: comprimento || null,
        descricao: descricao || '',
        imagem: imagem || '',
        categoria,
        categoryId: categoryId || null,
        marca: marca || '',
        brandId: brandId || null,
        fornecedor: fornecedorNome || '',
        supplierId: supplierId || null,
        updatedAt: new Date().toISOString()
    };
    
    if (!isEditing) {
        productData.createdAt = new Date().toISOString();
    } else {
        // Manter createdAt original
        const existingProduct = products.find(p => p.id === productId);
        if (existingProduct) {
            productData.createdAt = existingProduct.createdAt;
        } else {
            productData.createdAt = new Date().toISOString();
        }
    }
    
    // Salvar produto
    if (isEditing) {
        const index = products.findIndex(p => p.id === productId);
        if (index !== -1) {
            products[index] = productData;
        }
        addSystemLog('edit_product', `Produto editado: ${nome}`, currentUser ? currentUser.username : 'Sistema');
    } else {
        products.push(productData);
        addSystemLog('create_product', `Produto criado: ${nome}`, currentUser ? currentUser.username : 'Sistema');
    }
    
    saveProducts();
    updateInventoryProductsCount(); // Atualizar contador no botão
    autoSave(); // Salvamento automático
    
    // Limpar TUDO após salvar para garantir que próximo cadastro seja novo
    editingProductId = null;
    document.getElementById('product-id').value = '';
    document.getElementById('product-form').reset();
    document.getElementById('product-form-title').textContent = 'Cadastrar Novo Produto';
    document.getElementById('product-image-preview').style.display = 'none';
    document.getElementById('remove-product-image-btn').style.display = 'none';
    document.getElementById('product-brand-other-group').style.display = 'none';
    document.getElementById('product-category-other-group').style.display = 'none';
    
    // Popular selects novamente
    populateProductBrandSelect();
    populateProductCategorySelect();
    
    showProductsListView();
    loadProducts();
    
    alert(isEditing ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!');
    
    // Atualizar card de alerta de estoque crítico se estiver na tela inicial
    if (document.getElementById('home') && document.getElementById('home').classList.contains('active')) {
        loadCriticalStockAlert();
    }
}

// Alterar quantidade em estoque
function alterProductStock(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    document.getElementById('product-stock-id').value = productId;
    document.getElementById('product-stock-current').value = product.quantidadeEstoque || 0;
    document.getElementById('product-stock-new').value = product.quantidadeEstoque || 0;
    
    document.getElementById('product-stock-modal').style.display = 'block';
}

// Processar alteração de estoque
function handleProductStockSubmit(event) {
    event.preventDefault();
    
    const productId = document.getElementById('product-stock-id').value;
    const newStock = parseInt(document.getElementById('product-stock-new').value);
    
    if (isNaN(newStock) || newStock < 0) {
        alert('Por favor, informe uma quantidade válida (número inteiro maior ou igual a zero).');
        return;
    }
    
    const product = products.find(p => p.id === productId);
    if (!product) {
        alert('Produto não encontrado.');
        return;
    }
    
    const oldStock = product.quantidadeEstoque || 0;
    product.quantidadeEstoque = newStock;
    product.updatedAt = new Date().toISOString();
    
    saveProducts();
    autoSave(); // Salvamento automático
    closeProductStockModal();
    loadProducts();
    
    // Adicionar log
    addSystemLog('update_product_stock', `Estoque alterado: ${product.nome} (${oldStock} → ${newStock})`, currentUser ? currentUser.username : 'Sistema');
    
    alert('Quantidade em estoque atualizada com sucesso!');
    
    // Atualizar card de alerta de estoque crítico se estiver na tela inicial
    if (document.getElementById('home') && document.getElementById('home').classList.contains('active')) {
        loadCriticalStockAlert();
    }
}

// ==================== ALERTA DE ESTOQUE CRÍTICO ====================

// Carregar alerta de estoque crítico na tela inicial
function loadCriticalStockAlert() {
    const container = document.getElementById('critical-stock-alert-container');
    const productsList = document.getElementById('critical-stock-products-list');
    
    if (!container || !productsList) return;
    
    // Garantir que os produtos estejam carregados
    if (!products || products.length === 0) {
        loadProductsFromStorage();
    }
    
    // Obter configurações de regras
    const settings = getStockVisibilitySettings();
    
    // Agrupar produtos por regra
    const productsByRule = {
        rule1: [], // Estoque <= 0 (fixa, sempre ativa)
        rule2: [], // Configurável 1
        rule3: []  // Configurável 2
    };
    
    products.forEach(product => {
        const stock = product.quantidadeEstoque || 0;
        
        // Regra 1: Estoque <= 0 (sempre verificar, tem prioridade)
        if (stock <= 0) {
            productsByRule.rule1.push(product);
            return; // Não verificar outras regras para este produto
        }
        
        // Regra 2: Se ativada e estoque <= limite
        if (settings.rule2.enabled && stock > 0 && stock <= settings.rule2.limit) {
            productsByRule.rule2.push(product);
            return; // Não verificar regra 3 para este produto
        }
        
        // Regra 3: Se ativada e estoque <= limite (e não está na regra 2)
        if (settings.rule3.enabled && stock > 0 && stock <= settings.rule3.limit) {
            // Só incluir se não está na regra 2
            if (!settings.rule2.enabled || stock > settings.rule2.limit) {
                productsByRule.rule3.push(product);
            }
        }
    });
    
    // Verificar se há produtos em alguma regra
    const hasProducts = productsByRule.rule1.length > 0 || 
                       productsByRule.rule2.length > 0 || 
                       productsByRule.rule3.length > 0;
    
    if (!hasProducts) {
        container.style.display = 'none';
        return;
    }
    
    // Mostrar o container
    container.style.display = 'block';
    
    // Renderizar cards por regra
    let html = '';
    
    // Regra 1: Estoque <= 0 (card piscando)
    if (productsByRule.rule1.length > 0) {
        html += `
            <div class="stock-alert-rule-group" data-rule="1" data-pulse="true">
                <div class="stock-alert-rule-header">
                    <h4>⚠️ Estoque Zero ou Negativo</h4>
                    <span class="stock-alert-count">${productsByRule.rule1.length} produto(s)</span>
                </div>
                <div class="stock-alert-products-grid">
                    ${productsByRule.rule1.map(product => renderStockProductCard(product)).join('')}
                </div>
            </div>
        `;
    }
    
    // Regra 2: Configurável
    if (productsByRule.rule2.length > 0) {
        html += `
            <div class="stock-alert-rule-group" data-rule="2" style="background: linear-gradient(135deg, ${settings.rule2.color} 0%, ${adjustColorBrightness(settings.rule2.color, -20)} 100%);">
                <div class="stock-alert-rule-header">
                    <h4>📊 Estoque Baixo (≤ ${settings.rule2.limit})</h4>
                    <span class="stock-alert-count">${productsByRule.rule2.length} produto(s)</span>
                </div>
                <div class="stock-alert-products-grid">
                    ${productsByRule.rule2.map(product => renderStockProductCard(product)).join('')}
                </div>
            </div>
        `;
    }
    
    // Regra 3: Configurável
    if (productsByRule.rule3.length > 0) {
        html += `
            <div class="stock-alert-rule-group" data-rule="3" style="background: linear-gradient(135deg, ${settings.rule3.color} 0%, ${adjustColorBrightness(settings.rule3.color, -20)} 100%);">
                <div class="stock-alert-rule-header">
                    <h4>📊 Estoque Muito Baixo (≤ ${settings.rule3.limit})</h4>
                    <span class="stock-alert-count">${productsByRule.rule3.length} produto(s)</span>
                </div>
                <div class="stock-alert-products-grid">
                    ${productsByRule.rule3.map(product => renderStockProductCard(product)).join('')}
                </div>
            </div>
        `;
    }
    
    productsList.innerHTML = html;
}

// Renderizar card de produto
function renderStockProductCard(product) {
    const nome = product.nome || product.name || 'Produto sem nome';
    const codigoBarras = product.codigoBarras || product.barcode || 'N/A';
    const imagem = product.imagem || product.image || '';
    const estoque = product.quantidadeEstoque || 0;
    
    return `
        <div class="critical-stock-product-card" onclick="openEditProductWithStockFocus('${product.id}')">
            <div class="critical-stock-product-image">
                ${imagem 
                    ? `<img src="${imagem}" alt="${nome}" />` 
                    : '<div class="critical-stock-product-placeholder">📦</div>'
                }
            </div>
            <div class="critical-stock-product-info">
                <div class="critical-stock-product-name">${nome}</div>
                <div class="critical-stock-product-barcode">Código: ${codigoBarras}</div>
                <div class="critical-stock-product-stock">Estoque: ${estoque} unidades</div>
            </div>
        </div>
    `;
}

// Ajustar brilho de cor (para criar gradiente)
function adjustColorBrightness(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// Abrir edição de produto e focar no campo de estoque
function openEditProductWithStockFocus(productId) {
    // Abrir modal de edição
    openEditProductModal(productId);
    
    // Aguardar o formulário ser renderizado e focar no campo de estoque
    setTimeout(() => {
        const stockField = document.getElementById('product-stock');
        if (stockField) {
            stockField.focus();
            stockField.select();
        }
    }, 500);
}

// Upload de imagem do produto
function handleProductImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validar tipo
    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem.');
        return;
    }
    
    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB.');
        return;
    }
    
    // Usar o sistema de cropping existente
    openCropModal(file, 'product-photo', 1, (croppedImageData) => {
        // Atualizar preview
        const preview = document.getElementById('product-image-preview');
        preview.src = croppedImageData;
        preview.style.display = 'block';
        document.getElementById('remove-product-image-btn').style.display = 'block';
    });
}

// Remover imagem do produto
function removeProductImage() {
    if (confirm('Tem certeza que deseja remover a imagem do produto?')) {
        document.getElementById('product-image-preview').style.display = 'none';
        document.getElementById('product-image-preview').src = '';
        document.getElementById('remove-product-image-btn').style.display = 'none';
        document.getElementById('product-image-input').value = '';
    }
}

// Alterar imagem a partir do modal de detalhes
function changeProductImageFromModal() {
    if (!selectedProductId) return;
    
    // Criar input temporário para seleção de arquivo
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validar tipo
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione um arquivo de imagem.');
            return;
        }
        
        // Validar tamanho (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('A imagem deve ter no máximo 5MB.');
            return;
        }
        
        // Usar o sistema de cropping existente
        openCropModal(file, 'product-photo', 1, (croppedImageData) => {
            updateProductImage(selectedProductId, croppedImageData);
        });
    };
    input.click();
}

// Atualizar imagem do produto
function updateProductImage(productId, imageSrc) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    product.imagem = imageSrc;
    product.updatedAt = new Date().toISOString();
    saveProducts();
    loadProducts();
    
    // Atualizar modal se estiver aberto
    if (selectedProductId === productId) {
        openProductDetailsModal(productId);
    }
}

// Remover imagem a partir do modal de detalhes
function removeProductImageFromModal() {
    if (!selectedProductId) return;
    
    if (confirm('Tem certeza que deseja remover a imagem do produto?')) {
        const product = products.find(p => p.id === selectedProductId);
        if (product) {
            product.imagem = '';
            product.updatedAt = new Date().toISOString();
            saveProducts();
            loadProducts();
            openProductDetailsModal(selectedProductId);
        }
    }
}

// Verificar se categoria é "Outras" e mostrar campo de texto
function checkProductCategory() {
    const categorySelect = document.getElementById('product-category');
    const otherGroup = document.getElementById('product-category-other-group');
    
    if (categorySelect.value === 'Outras') {
        otherGroup.style.display = 'block';
    } else {
        otherGroup.style.display = 'none';
        document.getElementById('product-category-other').value = '';
    }
}

// Popular select de categorias com dados do módulo
function populateProductCategorySelect() {
    const categorySelect = document.getElementById('product-category');
    if (!categorySelect) return;
    
    loadCategoriesFromStorage();
    
    // Salvar valor atual
    const currentValue = categorySelect.value;
    
    // Limpar e adicionar opção padrão
    categorySelect.innerHTML = '<option value="">Selecione uma categoria...</option>';
    
    // Adicionar categorias ativas
    const activeCategories = categories.filter(c => c.status_ativo !== false);
    activeCategories.sort((a, b) => a.nome_categoria.localeCompare(b.nome_categoria));
    
    activeCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.nome_categoria;
        option.textContent = category.nome_categoria;
        option.dataset.categoryId = category.id;
        categorySelect.appendChild(option);
    });
    
    // Adicionar opção "Outras"
    const outrasOption = document.createElement('option');
    outrasOption.value = 'Outras';
    outrasOption.textContent = 'Outras';
    categorySelect.appendChild(outrasOption);
    
    // Restaurar valor se ainda existir
    if (currentValue) {
        const option = categorySelect.querySelector(`option[value="${currentValue}"]`);
        if (option) {
            categorySelect.value = currentValue;
        }
    }
}

// Popular select de marcas com dados do módulo
function populateProductBrandSelect() {
    const brandSelect = document.getElementById('product-brand');
    if (!brandSelect) return;
    
    loadBrandsFromStorage();
    
    // Salvar valor atual
    const currentValue = brandSelect.value;
    
    // Limpar e adicionar opção padrão
    brandSelect.innerHTML = '<option value="">Selecione uma marca...</option>';
    
    // Adicionar marcas ativas
    const activeBrands = brands.filter(b => b.status_ativo !== false);
    activeBrands.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    
    activeBrands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand.nome_completo;
        option.textContent = brand.nome_completo;
        option.dataset.brandId = brand.id;
        brandSelect.appendChild(option);
    });
    
    // Adicionar opção "Outras"
    const outrasOption = document.createElement('option');
    outrasOption.value = 'Outras';
    outrasOption.textContent = 'Outras';
    brandSelect.appendChild(outrasOption);
    
    // Restaurar valor se ainda existir
    if (currentValue) {
        const option = brandSelect.querySelector(`option[value="${currentValue}"]`);
        if (option) {
            brandSelect.value = currentValue;
        }
    }
}

// Verificar se marca é "Outras" e mostrar campo de texto
function checkProductBrand() {
    const brandSelect = document.getElementById('product-brand');
    const otherGroup = document.getElementById('product-brand-other-group');
    
    if (brandSelect.value === 'Outras') {
        otherGroup.style.display = 'block';
    } else {
        otherGroup.style.display = 'none';
        document.getElementById('product-brand-other').value = '';
    }
}

// Popular select de fornecedores com dados do módulo
function populateProductSupplierSelect() {
    const supplierSelect = document.getElementById('product-supplier');
    if (!supplierSelect) return;
    
    loadSuppliersFromStorage();
    
    // Salvar valor atual
    const currentValue = supplierSelect.value;
    
    // Limpar e adicionar opção padrão
    supplierSelect.innerHTML = '<option value="">Selecione um fornecedor...</option>';
    
    // Adicionar fornecedores ativos
    const activeSuppliers = suppliers.filter(s => s.situacao !== 'Inativo');
    activeSuppliers.sort((a, b) => {
        const nomeA = a.nome || a.nomeFantasia || '';
        const nomeB = b.nome || b.nomeFantasia || '';
        return nomeA.localeCompare(nomeB);
    });
    
    activeSuppliers.forEach(supplier => {
        const option = document.createElement('option');
        const displayName = supplier.nome || supplier.nomeFantasia || 'Fornecedor sem nome';
        option.value = displayName;
        option.textContent = displayName;
        option.dataset.supplierId = supplier.id;
        supplierSelect.appendChild(option);
    });
    
    // Adicionar opção "Outro (Novo Fornecedor)"
    const outroOption = document.createElement('option');
    outroOption.value = 'Outro (Novo Fornecedor)';
    outroOption.textContent = 'Outro (Novo Fornecedor)';
    supplierSelect.appendChild(outroOption);
    
    // Restaurar valor se ainda existir
    if (currentValue) {
        const option = supplierSelect.querySelector(`option[value="${currentValue}"]`);
        if (option) {
            supplierSelect.value = currentValue;
            checkProductSupplier(); // Atualizar visibilidade do campo "Outro"
        }
    }
}

// Verificar se fornecedor é "Outro (Novo Fornecedor)" e mostrar campo de texto
function checkProductSupplier() {
    const supplierSelect = document.getElementById('product-supplier');
    const otherGroup = document.getElementById('product-supplier-other-group');
    
    if (!supplierSelect || !otherGroup) return;
    
    if (supplierSelect.value === 'Outro (Novo Fornecedor)') {
        otherGroup.style.display = 'block';
        // Tornar campo obrigatório quando visível
        const otherInput = document.getElementById('product-supplier-other');
        if (otherInput) {
            otherInput.required = true;
        }
    } else {
        otherGroup.style.display = 'none';
        const otherInput = document.getElementById('product-supplier-other');
        if (otherInput) {
            otherInput.value = '';
            otherInput.required = false;
        }
    }
}

// Adicionar event listeners quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Event listener para salvamento automático antes de fechar navegador/aba
    window.addEventListener('beforeunload', function(e) {
        autoSave();
    });
    
    // Formulário de produto
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleProductSubmit(e);
        });
    }
    
    // Formulário de marca/fabricante
    const brandForm = document.getElementById('brand-form');
    if (brandForm) {
        brandForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveBrand();
        });
    }
    
    // Formulário de categoria
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveCategory();
        });
    }
    
    // Upload de imagem
    const productImageInput = document.getElementById('product-image-input');
    if (productImageInput) {
        productImageInput.addEventListener('change', handleProductImageUpload);
    }
    
    // Select de marca
    const productBrand = document.getElementById('product-brand');
    if (productBrand) {
        productBrand.addEventListener('change', checkProductBrand);
    }
    
    // Formulário de estoque
    const productStockForm = document.getElementById('product-stock-form');
    if (productStockForm) {
        productStockForm.addEventListener('submit', handleProductStockSubmit);
    }
    
    // Fechar modais ao clicar fora
    window.onclick = function(event) {
        const productDetailsModal = document.getElementById('product-details-modal');
        const productStockModal = document.getElementById('product-stock-modal');
        
        if (event.target === productDetailsModal) {
            closeProductDetailsModal();
        }
        if (event.target === productStockModal) {
            closeProductStockModal();
        }
        
        const supplierDetailsModal = document.getElementById('supplier-details-modal');
        if (event.target === supplierDetailsModal) {
            closeSupplierDetailsModal();
        }
        
        const clientDetailsModal = document.getElementById('client-details-modal');
        if (event.target === clientDetailsModal) {
            closeClientDetailsModal();
        }
        
        const userPermissionsModal = document.getElementById('user-permissions-modal');
        if (event.target === userPermissionsModal) {
            closeUserPermissionsModal();
        }
    };
    
    // Configurar event listeners dos cards
    setupCardEventListeners();
    
    // Formulário de fornecedor
    const supplierForm = document.getElementById('supplier-form');
    if (supplierForm) {
        supplierForm.addEventListener('submit', handleSupplierSubmit);
    }
    
    // Upload de logo do fornecedor
    const supplierLogoInput = document.getElementById('supplier-logo-input');
    if (supplierLogoInput) {
        supplierLogoInput.addEventListener('change', handleSupplierLogoUpload);
    }
    
    // Formulário de cliente no inventário
    const inventoryClientForm = document.getElementById('inventory-client-form');
    if (inventoryClientForm) {
        inventoryClientForm.addEventListener('submit', handleInventoryClientSubmit);
    }
    
    // Upload de foto do cliente no inventário
    const inventoryClientPhotoInput = document.getElementById('inventory-client-photo-input');
    if (inventoryClientPhotoInput) {
        inventoryClientPhotoInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            if (!file.type.startsWith('image/')) {
                alert('Por favor, selecione um arquivo de imagem.');
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) {
                alert('A imagem deve ter no máximo 5MB.');
                return;
            }
            
            openCropModal(file, 'client-photo', 1, (croppedImageData) => {
                const preview = document.getElementById('inventory-client-photo-preview');
                if (preview) {
                    preview.src = croppedImageData;
                    preview.style.display = 'block';
                }
            });
        });
    }
});

// Configurar event listeners dos cards nas novas localizações
function setupCardEventListeners() {
    // Card de Clientes Cadastrados (agora na seção all-clients)
    const totalClientsCard = document.querySelector('#all-clients .stat-card');
    if (totalClientsCard && !totalClientsCard.hasAttribute('data-listener-setup')) {
        totalClientsCard.style.cursor = 'pointer';
        totalClientsCard.setAttribute('data-listener-setup', 'true');
        totalClientsCard.addEventListener('click', () => {
            if (isLicenseExpired()) {
                showSection('license');
                return;
            }
            // Já está na seção de clientes, apenas garantir que está na lista
            showClientsListView();
        });
    }

    // Card de Aniversários (agora na seção greetings)
    const todayBirthdaysCard = document.querySelector('#greetings .stat-card');
    if (todayBirthdaysCard && !todayBirthdaysCard.hasAttribute('data-listener-setup')) {
        todayBirthdaysCard.style.cursor = 'pointer';
        todayBirthdaysCard.setAttribute('data-listener-setup', 'true');
        todayBirthdaysCard.addEventListener('click', () => {
            if (isLicenseExpired()) {
                showSection('license');
                return;
            }
            // Já está na seção de felicitações, não precisa fazer nada
        });
    }
}

// ==================== FUNÇÕES DO SISTEMA DE FORNECEDORES ====================

// Salvar fornecedores no localStorage
function saveSuppliers() {
    localStorage.setItem('suppliers', JSON.stringify(suppliers));
}

// Carregar fornecedores do localStorage
function loadSuppliersFromStorage() {
    suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
}

// Gerar ID único para fornecedor
function generateSupplierId() {
    return 'supplier_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Mostrar lista de fornecedores
function showSuppliersListView() {
    document.getElementById('suppliers-list-view').classList.add('active');
    document.getElementById('suppliers-register-view').classList.remove('active');
    loadSuppliers();
}

// Mostrar formulário de cadastro/edição
function showSuppliersRegisterView() {
    const listView = document.getElementById('suppliers-list-view');
    const registerView = document.getElementById('suppliers-register-view');
    if (listView) listView.classList.remove('active');
    if (registerView) registerView.classList.add('active');
    // Não resetar o formulário se estiver editando
    if (!editingSupplierId) {
        resetSupplierForm();
    }
}

// Resetar formulário de fornecedor
function resetSupplierForm() {
    document.getElementById('supplier-form').reset();
    document.getElementById('supplier-id').value = '';
    document.getElementById('supplier-form-title').textContent = 'Cadastrar Novo Fornecedor';
    document.getElementById('supplier-logo-preview').style.display = 'none';
    document.getElementById('remove-supplier-logo-btn').style.display = 'none';
    document.getElementById('supplier-person-type').value = '';
    updateSupplierDocumentField();
    editingSupplierId = null;
}

// Atualizar campo de documento baseado no tipo de pessoa
function updateSupplierDocumentField() {
    const personType = document.getElementById('supplier-person-type').value;
    const documentLabel = document.getElementById('supplier-document-label');
    const documentInput = document.getElementById('supplier-document');
    
    if (personType === 'Física') {
        documentLabel.textContent = 'CPF *';
        documentInput.placeholder = '000.000.000-00';
    } else if (personType === 'Jurídica') {
        documentLabel.textContent = 'CNPJ *';
        documentInput.placeholder = '00.000.000/0000-00';
    } else {
        documentLabel.textContent = 'CPF/CNPJ *';
        documentInput.placeholder = '';
    }
}

// Formatar CEP
function formatCEP(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 5) {
        value = value.substring(0, 5) + '-' + value.substring(5, 8);
    }
    input.value = value;
}

// Carregar e exibir fornecedores
function loadSuppliers() {
    const container = document.getElementById('suppliers-list');
    if (!container) return;
    
    loadSuppliersFromStorage();
    
    // Aplicar filtros
    let filteredSuppliers = suppliers;
    
    // Filtro de pesquisa
    const searchQuery = document.getElementById('supplier-search-input')?.value.toLowerCase() || '';
    if (searchQuery) {
        filteredSuppliers = filteredSuppliers.filter(s => 
            s.nome.toLowerCase().includes(searchQuery) ||
            (s.nomeFantasia && s.nomeFantasia.toLowerCase().includes(searchQuery))
        );
    }
    
    // Filtro de categoria
    const categoryFilter = document.getElementById('supplier-category-filter')?.value || '';
    if (categoryFilter) {
        filteredSuppliers = filteredSuppliers.filter(s => s.categoria === categoryFilter);
    }
    
    // Limpar container
    container.innerHTML = '';
    
    if (filteredSuppliers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum fornecedor cadastrado</h3>
                <p>Comece cadastrando seu primeiro fornecedor!</p>
            </div>
        `;
        return;
    }
    
    // Popular filtro de categorias
    populateSupplierCategoryFilter();
    
    // Criar cards
    filteredSuppliers.forEach(supplier => {
        const card = createSupplierCard(supplier);
        container.appendChild(card);
    });
}

// Criar card de fornecedor
function createSupplierCard(supplier) {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.onclick = () => editSupplierFromCard(supplier.id);
    
    const logoHtml = supplier.logo 
        ? `<img src="${supplier.logo}" alt="${supplier.nome}" class="client-photo" style="max-width: 100px; max-height: 100px; object-fit: cover;">`
        : '<div class="client-photo" style="background: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 24px; width: 100px; height: 100px;">🏢</div>';
    
    const statusClass = supplier.situacao === 'Ativo' ? 'active' : 'inactive';
    const statusBadge = `<span class="status-badge ${statusClass}">${supplier.situacao || 'Ativo'}</span>`;
    
    card.innerHTML = `
        <div class="client-card-header">
            ${logoHtml}
            <h3>${supplier.nome} ${statusBadge}</h3>
        </div>
        ${supplier.nomeFantasia ? `<div class="client-info"><strong>Nome Fantasia:</strong> ${supplier.nomeFantasia}</div>` : ''}
        ${supplier.telefone ? `<div class="client-info"><strong>Telefone:</strong> ${supplier.telefone}</div>` : ''}
        <div class="client-actions" onclick="event.stopPropagation()">
            <button class="btn btn-edit" onclick="editSupplierFromCard('${supplier.id}')">✏️ Editar</button>
            <button class="btn btn-delete" onclick="deleteSupplierFromCard('${supplier.id}')">🗑️ Excluir</button>
        </div>
    `;
    
    return card;
}

// Popular filtro de categorias
function populateSupplierCategoryFilter() {
    const filter = document.getElementById('supplier-category-filter');
    if (!filter) return;
    
    const currentValue = filter.value;
    const categories = [...new Set(suppliers.map(s => s.categoria).filter(c => c))].sort();
    
    filter.innerHTML = '<option value="">Todas as Categorias</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        filter.appendChild(option);
    });
    
    if (currentValue) {
        filter.value = currentValue;
    }
}

// Pesquisar fornecedores
function searchSuppliers() {
    loadSuppliers();
}

// Filtrar fornecedores por categoria
function filterSuppliersByCategory() {
    loadSuppliers();
}

// Abrir modal de detalhes do fornecedor
function openSupplierDetailsModal(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    
    selectedSupplierId = supplierId;
    
    document.getElementById('supplier-details-name').textContent = supplier.nome;
    document.getElementById('supplier-details-fantasy-name').textContent = supplier.nomeFantasia || '-';
    document.getElementById('supplier-details-status').textContent = supplier.situacao || 'Ativo';
    
    const logoPreview = document.getElementById('supplier-details-logo');
    const logoPlaceholder = document.getElementById('supplier-details-logo-placeholder');
    const changeBtn = document.getElementById('change-supplier-logo-btn');
    const removeBtn = document.getElementById('remove-supplier-logo-modal-btn');
    
    if (supplier.logo) {
        logoPreview.src = supplier.logo;
        logoPreview.style.display = 'block';
        logoPlaceholder.style.display = 'none';
        changeBtn.style.display = 'block';
        removeBtn.style.display = 'block';
    } else {
        logoPreview.style.display = 'none';
        logoPlaceholder.style.display = 'flex';
        changeBtn.style.display = 'none';
        removeBtn.style.display = 'none';
    }
    
    document.getElementById('supplier-details-modal').style.display = 'block';
}

// Fechar modal de detalhes
function closeSupplierDetailsModal() {
    document.getElementById('supplier-details-modal').style.display = 'none';
    selectedSupplierId = null;
}

// Editar fornecedor a partir do modal
function editSupplierFromModal() {
    if (!selectedSupplierId) return;
    
    closeSupplierDetailsModal();
    openEditSupplierModal(selectedSupplierId);
}

// Abrir modal de edição
function openEditSupplierModal(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    
    editingSupplierId = supplierId;
    
    // Preencher formulário
    document.getElementById('supplier-id').value = supplier.id;
    document.getElementById('supplier-name').value = supplier.nome || '';
    document.getElementById('supplier-fantasy-name').value = supplier.nomeFantasia || '';
    document.getElementById('supplier-person-type').value = supplier.tipoPessoa || '';
    updateSupplierDocumentField();
    document.getElementById('supplier-document').value = supplier.documento || '';
    document.getElementById('supplier-state-registration').value = supplier.inscricaoEstadual || '';
    document.getElementById('supplier-phone').value = supplier.telefone || '';
    document.getElementById('supplier-email').value = supplier.email || '';
    document.getElementById('supplier-cep').value = supplier.cep || '';
    document.getElementById('supplier-address').value = supplier.endereco || '';
    document.getElementById('supplier-city').value = supplier.cidade || '';
    document.getElementById('supplier-state').value = supplier.estado || '';
    document.getElementById('supplier-bank').value = supplier.banco || '';
    document.getElementById('supplier-agency').value = supplier.agencia || '';
    document.getElementById('supplier-account').value = supplier.conta || '';
    document.getElementById('supplier-pix').value = supplier.pix || '';
    document.getElementById('supplier-payment-terms').value = supplier.condicoesPagamento || '';
    document.getElementById('supplier-category').value = supplier.categoria || '';
    document.getElementById('supplier-status').value = supplier.situacao || 'Ativo';
    document.getElementById('supplier-notes').value = supplier.observacoes || '';
    
    // Logo
    const preview = document.getElementById('supplier-logo-preview');
    const removeBtn = document.getElementById('remove-supplier-logo-btn');
    if (supplier.logo) {
        preview.src = supplier.logo;
        preview.style.display = 'block';
        removeBtn.style.display = 'block';
    } else {
        preview.style.display = 'none';
        removeBtn.style.display = 'none';
    }
    
    document.getElementById('supplier-form-title').textContent = 'Editar Fornecedor';
    
    // Garantir que estamos na seção de inventário
    const inventorySection = document.getElementById('inventory');
    if (!inventorySection || !inventorySection.classList.contains('active')) {
        // Navegar para a seção de inventário primeiro
        showSection('inventory');
    }
    
    // Garantir que estamos na view de fornecedores do inventário
    const inventorySuppliersView = document.getElementById('inventory-suppliers-view');
    if (!inventorySuppliersView || !inventorySuppliersView.classList.contains('active')) {
        // Se não estiver na view de fornecedores, mudar para ela primeiro
        showInventoryView('suppliers');
        // Aguardar um pouco para garantir que a view foi carregada
        setTimeout(() => {
            showSuppliersRegisterView();
        }, 200);
    } else {
        // Já está na view correta, apenas mostrar o formulário
        showSuppliersRegisterView();
    }
}

// Alternar situação do fornecedor
function toggleSupplierStatusFromModal() {
    if (!selectedSupplierId) return;
    
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (!supplier) return;
    
    const newStatus = supplier.situacao === 'Ativo' ? 'Inativo' : 'Ativo';
    
    if (confirm(`Deseja alterar a situação do fornecedor para "${newStatus}"?`)) {
        supplier.situacao = newStatus;
        supplier.updatedAt = new Date().toISOString();
        saveSuppliers();
        loadSuppliers();
        openSupplierDetailsModal(selectedSupplierId);
        
        // Adicionar log
        addSystemLog('update_supplier_status', `Situação alterada: ${supplier.nome} (${newStatus})`, currentUser ? currentUser.username : 'Sistema');
        
        alert('Situação do fornecedor atualizada com sucesso!');
    }
}

// Excluir fornecedor a partir do modal
function deleteSupplierFromModal() {
    if (!selectedSupplierId) return;
    
    if (confirm('Tem certeza que deseja excluir este fornecedor?')) {
        deleteSupplier(selectedSupplierId);
        closeSupplierDetailsModal();
    }
}

// Excluir fornecedor
function deleteSupplier(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    
    suppliers = suppliers.filter(s => s.id !== supplierId);
    saveSuppliers();
    updateInventorySuppliersCount(); // Atualizar contador no botão
    autoSave(); // Salvamento automático
    loadSuppliers();
    
    // Adicionar log
    addSystemLog('delete_supplier', `Fornecedor excluído: ${supplier.nome}`, currentUser ? currentUser.username : 'Sistema');
    
    alert('Fornecedor excluído com sucesso!');
}

// Processar formulário de fornecedor
function handleSupplierSubmit(event) {
    event.preventDefault();
    
    const supplierId = document.getElementById('supplier-id').value;
    const isEditing = !!supplierId;
    
    // Validar campos obrigatórios
    const nome = document.getElementById('supplier-name').value.trim();
    const nomeFantasia = document.getElementById('supplier-fantasy-name').value.trim();
    const tipoPessoa = document.getElementById('supplier-person-type').value;
    const documento = document.getElementById('supplier-document').value.trim();
    
    if (!nome) {
        alert('Por favor, preencha o Nome/Razão Social.');
        return;
    }
    
    if (!nomeFantasia) {
        alert('Por favor, preencha o Nome Fantasia.');
        return;
    }
    
    if (!tipoPessoa) {
        alert('Por favor, selecione o Tipo de Pessoa.');
        return;
    }
    
    if (!documento) {
        alert('Por favor, preencha o CPF/CNPJ.');
        return;
    }
    
    // Obter valores
    const inscricaoEstadual = document.getElementById('supplier-state-registration').value.trim();
    const telefone = document.getElementById('supplier-phone').value.trim();
    const email = document.getElementById('supplier-email').value.trim();
    const cep = document.getElementById('supplier-cep').value.trim();
    const endereco = document.getElementById('supplier-address').value.trim();
    const cidade = document.getElementById('supplier-city').value.trim();
    const estado = document.getElementById('supplier-state').value.trim();
    const banco = document.getElementById('supplier-bank').value.trim();
    const agencia = document.getElementById('supplier-agency').value.trim();
    const conta = document.getElementById('supplier-account').value.trim();
    const pix = document.getElementById('supplier-pix').value.trim();
    const condicoesPagamento = document.getElementById('supplier-payment-terms').value.trim();
    const categoria = document.getElementById('supplier-category').value || '';
    const situacao = document.getElementById('supplier-status').value || 'Ativo';
    const observacoes = document.getElementById('supplier-notes').value.trim();
    
    // Obter logo (se houver preview)
    const logoPreview = document.getElementById('supplier-logo-preview');
    const logo = logoPreview.style.display !== 'none' ? logoPreview.src : '';
    
    const supplierData = {
        id: isEditing ? supplierId : generateSupplierId(),
        nome,
        nomeFantasia,
        tipoPessoa,
        documento,
        inscricaoEstadual: inscricaoEstadual || '',
        telefone: telefone || '',
        email: email || '',
        cep: cep || '',
        endereco: endereco || '',
        cidade: cidade || '',
        estado: estado || '',
        banco: banco || '',
        agencia: agencia || '',
        conta: conta || '',
        pix: pix || '',
        condicoesPagamento: condicoesPagamento || '',
        categoria: categoria || '',
        situacao,
        observacoes: observacoes || '',
        logo: logo || '',
        updatedAt: new Date().toISOString()
    };
    
    if (!isEditing) {
        supplierData.createdAt = new Date().toISOString();
    } else {
        // Manter createdAt original
        const existingSupplier = suppliers.find(s => s.id === supplierId);
        if (existingSupplier) {
            supplierData.createdAt = existingSupplier.createdAt;
        } else {
            supplierData.createdAt = new Date().toISOString();
        }
    }
    
    // Salvar fornecedor
    if (isEditing) {
        const index = suppliers.findIndex(s => s.id === supplierId);
        if (index !== -1) {
            suppliers[index] = supplierData;
        }
        addSystemLog('edit_supplier', `Fornecedor editado: ${nome}`, currentUser ? currentUser.username : 'Sistema');
    } else {
        suppliers.push(supplierData);
        addSystemLog('create_supplier', `Fornecedor criado: ${nome}`, currentUser ? currentUser.username : 'Sistema');
    }
    
    saveSuppliers();
    updateInventorySuppliersCount(); // Atualizar contador no botão
    autoSave(); // Salvamento automático
    
    // Limpar editingSupplierId após salvar
    editingSupplierId = null;
    
    showSuppliersListView();
    loadSuppliers();
    
    alert(isEditing ? 'Fornecedor atualizado com sucesso!' : 'Fornecedor cadastrado com sucesso!');
}

// Upload de logo do fornecedor
function handleSupplierLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validar tipo
    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem.');
        return;
    }
    
    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB.');
        return;
    }
    
    // Usar o sistema de cropping existente
    openCropModal(file, 'supplier-logo', 1, (croppedImageData) => {
        // Atualizar preview
        const preview = document.getElementById('supplier-logo-preview');
        preview.src = croppedImageData;
        preview.style.display = 'block';
        document.getElementById('remove-supplier-logo-btn').style.display = 'block';
    });
}

// Remover logo do fornecedor
function removeSupplierLogo() {
    if (confirm('Tem certeza que deseja remover a logo do fornecedor?')) {
        document.getElementById('supplier-logo-preview').style.display = 'none';
        document.getElementById('supplier-logo-preview').src = '';
        document.getElementById('remove-supplier-logo-btn').style.display = 'none';
        document.getElementById('supplier-logo-input').value = '';
    }
}

// Alterar logo a partir do modal de detalhes
function changeSupplierLogoFromModal() {
    if (!selectedSupplierId) return;
    
    // Criar input temporário para seleção de arquivo
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validar tipo
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione um arquivo de imagem.');
            return;
        }
        
        // Validar tamanho (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('A imagem deve ter no máximo 5MB.');
            return;
        }
        
        // Usar o sistema de cropping existente
        openCropModal(file, 'supplier-logo', 1, (croppedImageData) => {
            updateSupplierLogo(selectedSupplierId, croppedImageData);
        });
    };
    input.click();
}

// Atualizar logo do fornecedor
function updateSupplierLogo(supplierId, logoSrc) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    
    supplier.logo = logoSrc;
    supplier.updatedAt = new Date().toISOString();
    saveSuppliers();
    loadSuppliers();
    
    // Atualizar modal se estiver aberto
    if (selectedSupplierId === supplierId) {
        openSupplierDetailsModal(supplierId);
    }
}

// Remover logo a partir do modal de detalhes
function removeSupplierLogoFromModal() {
    if (!selectedSupplierId) return;
    
    if (confirm('Tem certeza que deseja remover a logo do fornecedor?')) {
        const supplier = suppliers.find(s => s.id === selectedSupplierId);
        if (supplier) {
            supplier.logo = '';
            supplier.updatedAt = new Date().toISOString();
            saveSuppliers();
            loadSuppliers();
            openSupplierDetailsModal(selectedSupplierId);
        }
    }
}

// ==================== FUNÇÕES DE CLIENTES NO INVENTÁRIO ====================

// Mostrar lista de clientes no inventário
function showInventoryClientsListView() {
    const listView = document.getElementById('inventory-clients-list-view');
    const registerView = document.getElementById('inventory-clients-register-view');
    if (listView) listView.classList.add('active');
    if (registerView) registerView.classList.remove('active');
    loadInventoryClients();
}

// Mostrar formulário de cadastro/edição no inventário
function showInventoryClientsRegisterView(resetForm = true) {
    const listView = document.getElementById('inventory-clients-list-view');
    const registerView = document.getElementById('inventory-clients-register-view');
    if (listView) listView.classList.remove('active');
    if (registerView) registerView.classList.add('active');
    if (resetForm) {
        resetInventoryClientForm();
    }
}

// Resetar formulário de cliente no inventário
function resetInventoryClientForm() {
    const form = document.getElementById('inventory-client-form');
    if (form) form.reset();
    const clientId = document.getElementById('inventory-client-id');
    if (clientId) clientId.value = '';
    const formTitle = document.getElementById('inventory-client-form-title');
    if (formTitle) formTitle.textContent = 'Cadastrar Novo Cliente';
    const preview = document.getElementById('inventory-client-photo-preview');
    if (preview) preview.style.display = 'none';
    
    // Resetar campos dinâmicos
    const phonesContainer = document.getElementById('inventory-phones-container');
    if (phonesContainer) {
        phonesContainer.innerHTML = `
            <div class="dynamic-field">
                <input type="tel" class="phone-input" placeholder="(00) 00000-0000" required>
                <button type="button" class="btn-remove" onclick="removeInventoryField(this, 'phone')">Remover</button>
            </div>
        `;
    }
    
    const emailsContainer = document.getElementById('inventory-emails-container');
    if (emailsContainer) {
        emailsContainer.innerHTML = `
            <div class="dynamic-field">
                <input type="email" class="email-input" placeholder="email@exemplo.com" required>
                <button type="button" class="btn-remove" onclick="removeInventoryField(this, 'email')">Remover</button>
            </div>
        `;
    }
}

// Carregar clientes no inventário
function loadInventoryClients() {
    const container = document.getElementById('inventory-clients-list');
    if (!container) return;
    
    // Atualizar contador no botão lateral
    const countBadge = document.getElementById('inventory-clients-count');
    if (countBadge) {
        countBadge.textContent = `[${clients.length}]`;
    }
    
    // Aplicar filtros
    let filteredClients = clients;
    
    // Filtro de pesquisa
    const searchQuery = document.getElementById('inventory-client-search-input')?.value.toLowerCase() || '';
    if (searchQuery) {
        filteredClients = filteredClients.filter(c => 
            c.name.toLowerCase().includes(searchQuery)
        );
    }
    
    // Filtro de categoria
    const filterValue = document.getElementById('inventory-client-filter')?.value || '';
    if (filterValue === 'aniversario-proximo') {
        const today = new Date();
        const next30Days = new Date();
        next30Days.setDate(today.getDate() + 30);
        filteredClients = filteredClients.filter(c => {
            const birthdate = new Date(c.birthdate);
            const thisYear = new Date(today.getFullYear(), birthdate.getMonth(), birthdate.getDate());
            const nextYear = new Date(today.getFullYear() + 1, birthdate.getMonth(), birthdate.getDate());
            return (thisYear >= today && thisYear <= next30Days) || (nextYear >= today && nextYear <= next30Days);
        });
    } else if (filterValue === 'sem-aniversario') {
        filteredClients = filteredClients.filter(c => !c.birthdate);
    }
    
    if (filteredClients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>${searchQuery || filterValue ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</h3>
                <p>${searchQuery || filterValue ? 'Tente pesquisar com outro termo ou filtro.' : 'Comece cadastrando seu primeiro cliente!'}</p>
            </div>
        `;
        return;
    }
    
    // Limpar container
    container.innerHTML = '';
    
    // Criar cards
    filteredClients.forEach(client => {
        const card = createInventoryClientCard(client);
        container.appendChild(card);
    });
}

// Pesquisar clientes no inventário
function searchInventoryClients() {
    loadInventoryClients();
}

// Filtrar clientes no inventário
function filterInventoryClients() {
    loadInventoryClients();
}

// Criar card de cliente no inventário
function createInventoryClientCard(client) {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.onclick = () => editClientFromCard(client.id);
    card.style.cursor = 'pointer';
    
    const photoHtml = client.photo 
        ? `<img src="${client.photo}" alt="${client.name}" class="client-photo" style="max-width: 100px; max-height: 100px; object-fit: cover;">`
        : '<div class="client-photo" style="background: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 24px; width: 100px; height: 100px;">👤</div>';
    
    const phonesHtml = client.phones && client.phones.length > 0 
        ? `<div class="client-info"><strong>Telefone:</strong> ${client.phones[0]}</div>` 
        : '';
    
    card.innerHTML = `
        <div class="client-card-header">
            ${photoHtml}
            <h3>${client.name}</h3>
        </div>
        ${client.cpf ? `<div class="client-info"><strong>CPF:</strong> ${client.cpf}</div>` : ''}
        <div class="client-info"><strong>Data de Nascimento:</strong> ${formatDate(client.birthdate)}</div>
        ${phonesHtml}
        <div class="client-actions" onclick="event.stopPropagation()">
            <button class="btn btn-edit" onclick="editClientFromCard('${client.id}')">✏️ Editar</button>
            <button class="btn btn-delete" onclick="deleteClientFromCard('${client.id}')">🗑️ Excluir</button>
        </div>
    `;
    
    return card;
}

// Adicionar campo dinâmico no inventário
function addInventoryField(type) {
    const container = type === 'phone' 
        ? document.getElementById('inventory-phones-container')
        : document.getElementById('inventory-emails-container');
    
    if (!container) return;
    
    const field = document.createElement('div');
    field.className = 'dynamic-field';
    field.innerHTML = `
        <input type="${type === 'phone' ? 'tel' : 'email'}" 
               class="${type === 'phone' ? 'phone-input' : 'email-input'}" 
               placeholder="${type === 'phone' ? '(00) 00000-0000' : 'email@exemplo.com'}" 
               required>
        <button type="button" class="btn-remove" onclick="removeInventoryField(this, '${type}')">Remover</button>
    `;
    container.appendChild(field);
}

// Remover campo dinâmico no inventário
function removeInventoryField(button, type) {
    const field = button.parentElement;
    const container = type === 'phone' 
        ? document.getElementById('inventory-phones-container')
        : document.getElementById('inventory-emails-container');
    
    if (container && container.children.length > 1) {
        field.remove();
    }
}

// Processar formulário de cliente no inventário
function handleInventoryClientSubmit(event) {
    event.preventDefault();
    
    const clientId = document.getElementById('inventory-client-id').value;
    const isEditing = !!clientId;
    
    // Validar campos obrigatórios
    const name = document.getElementById('inventory-client-name').value.trim();
    const birthdate = document.getElementById('inventory-client-birthdate').value;
    
    if (!name) {
        alert('Por favor, preencha o nome do cliente.');
        return;
    }
    
    if (!birthdate) {
        alert('Por favor, preencha a data de nascimento.');
        return;
    }
    
    // Obter telefones e emails
    const phoneInputs = document.querySelectorAll('#inventory-phones-container .phone-input');
    const emailInputs = document.querySelectorAll('#inventory-emails-container .email-input');
    
    const phones = Array.from(phoneInputs).map(input => input.value.trim()).filter(v => v);
    const emails = Array.from(emailInputs).map(input => input.value.trim()).filter(v => v);
    
    if (phones.length === 0) {
        alert('Por favor, adicione pelo menos um telefone.');
        return;
    }
    
    if (emails.length === 0) {
        alert('Por favor, adicione pelo menos um email.');
        return;
    }
    
    // Obter foto
    const photoPreview = document.getElementById('inventory-client-photo-preview');
    const photo = photoPreview && photoPreview.style.display !== 'none' ? photoPreview.src : '';
    
    const clientData = {
        id: isEditing ? clientId : generateClientId(),
        name,
        cpf: document.getElementById('inventory-client-cpf').value.trim() || '',
        birthdate,
        phones,
        emails,
        photo: photo || '',
        updatedAt: new Date().toISOString()
    };
    
    if (!isEditing) {
        clientData.createdAt = new Date().toISOString();
    } else {
        const existingClient = clients.find(c => c.id === clientId);
        if (existingClient) {
            clientData.createdAt = existingClient.createdAt;
        } else {
            clientData.createdAt = new Date().toISOString();
        }
    }
    
    // Salvar cliente
    if (isEditing) {
        const index = clients.findIndex(c => c.id === clientId);
        if (index !== -1) {
            clients[index] = clientData;
        }
        addSystemLog('edit_client', `Cliente editado: ${name}`, currentUser ? currentUser.username : 'Sistema');
    } else {
        clients.push(clientData);
        addSystemLog('create_client', `Cliente criado: ${name}`, currentUser ? currentUser.username : 'Sistema');
    }
    
    saveClients();
    autoSave(); // Salvamento automático
    showInventoryClientsListView();
    loadInventoryClients();
    updateInventoryClientsCount(); // Atualizar contador no botão
    loadAllClients(); // Atualizar também a lista principal
    
    alert(isEditing ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
}

// Gerar ID único para cliente
function generateClientId() {
    return 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Salvar clientes
function saveClients() {
    localStorage.setItem('clients', JSON.stringify(clients));
}

// Abrir modal de detalhes do cliente
function openClientDetailsModal(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    selectedClientId = clientId;
    
    document.getElementById('client-details-name').textContent = client.name;
    
    const photoPreview = document.getElementById('client-details-photo');
    const photoPlaceholder = document.getElementById('client-details-photo-placeholder');
    const changeBtn = document.getElementById('change-client-photo-btn');
    const removeBtn = document.getElementById('remove-client-photo-modal-btn');
    
    if (client.photo) {
        photoPreview.src = client.photo;
        photoPreview.style.display = 'block';
        photoPlaceholder.style.display = 'none';
        if (changeBtn) changeBtn.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'block';
    } else {
        photoPreview.style.display = 'none';
        photoPlaceholder.style.display = 'flex';
        if (changeBtn) changeBtn.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'none';
    }
    
    // Preencher informações
    document.getElementById('client-details-cpf').innerHTML = client.cpf ? `<strong>CPF:</strong> ${client.cpf}` : '';
    document.getElementById('client-details-birthdate').innerHTML = `<strong>Data de Nascimento:</strong> ${formatDate(client.birthdate)}`;
    document.getElementById('client-details-phones').innerHTML = client.phones && client.phones.length > 0 
        ? `<strong>Telefones:</strong> ${client.phones.map(p => `📞 ${p}`).join(', ')}` 
        : '';
    document.getElementById('client-details-emails').innerHTML = client.emails && client.emails.length > 0 
        ? `<strong>Emails:</strong> ${client.emails.map(e => `✉️ ${e}`).join(', ')}` 
        : '';
    
    document.getElementById('client-details-modal').style.display = 'block';
}

// Fechar modal de detalhes do cliente
function closeClientDetailsModal() {
    document.getElementById('client-details-modal').style.display = 'none';
    selectedClientId = null;
}

// Editar cliente a partir do modal
function editClientFromModal() {
    if (!selectedClientId) return;
    
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;
    
    closeClientDetailsModal();
    
    // Verificar se estamos na view de clientes do inventário
    const inventoryClientsView = document.getElementById('inventory-clients-view');
    if (inventoryClientsView && inventoryClientsView.classList.contains('active')) {
        // Já está na view de inventário, apenas abrir o formulário
        openEditInventoryClientModal(selectedClientId);
    } else {
        // Navegar para a view de clientes do inventário primeiro
        showSection('inventory');
        showInventoryView('clients');
        // Aguardar um pouco para garantir que a view foi carregada
        setTimeout(() => {
            openEditInventoryClientModal(selectedClientId);
        }, 200);
    }
}

// Abrir modal de edição de cliente no inventário
function openEditInventoryClientModal(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    // Garantir que estamos na seção de inventário
    const inventorySection = document.getElementById('inventory');
    if (!inventorySection || !inventorySection.classList.contains('active')) {
        // Navegar para a seção de inventário primeiro
        showSection('inventory');
    }
    
    // Garantir que estamos na view de clientes do inventário
    const inventoryClientsView = document.getElementById('inventory-clients-view');
    if (!inventoryClientsView || !inventoryClientsView.classList.contains('active')) {
        // Se não estiver na view de clientes, mudar para ela primeiro
        showInventoryView('clients');
        // Aguardar um pouco para garantir que a view foi carregada
        setTimeout(() => {
            fillInventoryClientForm(client);
            showInventoryClientsRegisterView(false); // Não resetar o formulário
        }, 250);
    } else {
        // Já está na view correta, apenas preencher e mostrar o formulário
        fillInventoryClientForm(client);
        showInventoryClientsRegisterView(false); // Não resetar o formulário
    }
}

// Preencher formulário de cliente no inventário
function fillInventoryClientForm(client) {
    // Preencher formulário
    document.getElementById('inventory-client-id').value = client.id;
    document.getElementById('inventory-client-name').value = client.name || '';
    document.getElementById('inventory-client-cpf').value = client.cpf || '';
    
    let birthdateValue = client.birthdate;
    if (birthdateValue && birthdateValue.includes('T')) {
        birthdateValue = birthdateValue.split('T')[0];
    }
    document.getElementById('inventory-client-birthdate').value = birthdateValue;
    
    // Preencher telefones
    const phonesContainer = document.getElementById('inventory-phones-container');
    if (phonesContainer) {
        phonesContainer.innerHTML = '';
        if (client.phones && client.phones.length > 0) {
            client.phones.forEach(phone => {
                const field = document.createElement('div');
                field.className = 'dynamic-field';
                field.innerHTML = `
                    <input type="tel" class="phone-input" placeholder="(00) 00000-0000" value="${phone}" required>
                    <button type="button" class="btn-remove" onclick="removeInventoryField(this, 'phone')">Remover</button>
                `;
                phonesContainer.appendChild(field);
            });
        } else {
            addInventoryField('phone');
        }
    }
    
    // Preencher emails
    const emailsContainer = document.getElementById('inventory-emails-container');
    if (emailsContainer) {
        emailsContainer.innerHTML = '';
        if (client.emails && client.emails.length > 0) {
            client.emails.forEach(email => {
                const field = document.createElement('div');
                field.className = 'dynamic-field';
                field.innerHTML = `
                    <input type="email" class="email-input" placeholder="email@exemplo.com" value="${email}" required>
                    <button type="button" class="btn-remove" onclick="removeInventoryField(this, 'email')">Remover</button>
                `;
                emailsContainer.appendChild(field);
            });
        } else {
            addInventoryField('email');
        }
    }
    
    // Foto
    const preview = document.getElementById('inventory-client-photo-preview');
    if (client.photo && preview) {
        preview.src = client.photo;
        preview.style.display = 'block';
    } else if (preview) {
        preview.style.display = 'none';
    }
    
    document.getElementById('inventory-client-form-title').textContent = 'Editar Cliente';
}

// ==================== FUNÇÕES DE BOTÕES NOS CARDS ====================

// Editar produto a partir do card
function editProductFromCard(productId) {
    if (event) event.stopPropagation();
    openEditProductModal(productId);
}

// Excluir produto a partir do card
function deleteProductFromCard(productId) {
    event.stopPropagation();
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        deleteProduct(productId);
    }
}

// Editar fornecedor a partir do card
function editSupplierFromCard(supplierId) {
    if (event) event.stopPropagation();
    openEditSupplierModal(supplierId);
}

// Excluir fornecedor a partir do card
function deleteSupplierFromCard(supplierId) {
    event.stopPropagation();
    if (confirm('Tem certeza que deseja excluir este fornecedor?')) {
        deleteSupplier(supplierId);
    }
}

// Editar cliente a partir do card
function editClientFromCard(clientId) {
    if (event) event.stopPropagation();
    
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    // Sempre editar no inventário
    // Garantir que estamos na seção de inventário
    const inventorySection = document.getElementById('inventory');
    if (!inventorySection || !inventorySection.classList.contains('active')) {
        showSection('inventory');
    }
    
    // Garantir que estamos na view de clientes
    const inventoryClientsView = document.getElementById('inventory-clients-view');
    if (!inventoryClientsView || !inventoryClientsView.classList.contains('active')) {
        showInventoryView('clients');
        setTimeout(() => {
            openEditInventoryClientModal(clientId);
        }, 250);
    } else {
        // Já está na view correta, apenas abrir o formulário
        openEditInventoryClientModal(clientId);
    }
}

// Excluir cliente a partir do card
function deleteClientFromCard(clientId) {
    event.stopPropagation();
    deleteClient(clientId); // A função deleteClient já tem confirmação
}

// ==================== FUNÇÕES DE FORMAS DE PAGAMENTO ====================

// Inicializar formas de pagamento padrão
function initializePaymentMethods() {
    if (paymentMethods.length === 0) {
        const defaultMethods = [
            { id: Date.now() + 1, name: 'Dinheiro', description: '', active: true },
            { id: Date.now() + 2, name: 'Débito', description: '', active: true },
            { id: Date.now() + 3, name: 'Crédito à Vista', description: '', active: true },
            { id: Date.now() + 4, name: 'Crédito Parcelado', description: '', active: true, installments: 12 },
            { id: Date.now() + 5, name: 'A Prazo', description: '', active: true },
            { id: Date.now() + 6, name: 'PIX', description: '', active: true, pixType: 'cpf', pixKey: '', pixRecipient: '' }
        ];
        paymentMethods = defaultMethods;
        savePaymentMethods();
    }
}

// Salvar formas de pagamento no localStorage
function savePaymentMethods() {
    try {
        localStorage.setItem('paymentMethods', JSON.stringify(paymentMethods));
    } catch (error) {
        console.error('Erro ao salvar formas de pagamento:', error);
    }
}

// Mostrar view de formas de pagamento
function showPaymentMethodsView() {
    const settingsView = document.getElementById('inventory-settings-view');
    const paymentMethodsView = document.getElementById('payment-methods-view');
    if (settingsView) settingsView.querySelector('.settings-menu').style.display = 'none';
    if (paymentMethodsView) {
        paymentMethodsView.style.display = 'block';
        showPaymentMethodsList();
    }
}

// Mostrar view de lista de formas de pagamento
function showPaymentMethodsList() {
    const listView = document.getElementById('payment-methods-list-view');
    const registerView = document.getElementById('payment-methods-register-view');
    if (listView) listView.classList.add('active');
    if (registerView) registerView.classList.remove('active');
    loadPaymentMethodsList();
}

// Mostrar view de formulário de formas de pagamento
function showPaymentMethodsRegisterView() {
    const listView = document.getElementById('payment-methods-list-view');
    const registerView = document.getElementById('payment-methods-register-view');
    if (listView) listView.classList.remove('active');
    if (registerView) registerView.classList.add('active');
}

// Voltar ao menu de configurações
function backToSettingsMenu() {
    const settingsView = document.getElementById('inventory-settings-view');
    const paymentMethodsView = document.getElementById('payment-methods-view');
    const stockVisibilityView = document.getElementById('stock-visibility-view');
    const receivablesVisibilityView = document.getElementById('receivables-visibility-view');
    if (settingsView) settingsView.querySelector('.settings-menu').style.display = 'block';
    if (paymentMethodsView) paymentMethodsView.style.display = 'none';
    if (stockVisibilityView) stockVisibilityView.style.display = 'none';
    if (receivablesVisibilityView) receivablesVisibilityView.style.display = 'none';
}

// Mostrar view de visibilidade de estoque
function showStockVisibilityView() {
    const settingsView = document.getElementById('inventory-settings-view');
    const stockVisibilityView = document.getElementById('stock-visibility-view');
    if (settingsView) settingsView.querySelector('.settings-menu').style.display = 'none';
    if (stockVisibilityView) {
        stockVisibilityView.style.display = 'block';
        loadStockVisibilitySettings();
    }
}

// Carregar configurações de visibilidade de estoque
function loadStockVisibilitySettings() {
    const settings = getStockVisibilitySettings();
    
    // Regra 2
    document.getElementById('stock-rule-2-limit').value = settings.rule2.limit || 10;
    document.getElementById('stock-rule-2-color').value = settings.rule2.color || '#ffa500';
    document.getElementById('stock-rule-2-enabled').checked = settings.rule2.enabled !== false;
    
    // Regra 3
    document.getElementById('stock-rule-3-limit').value = settings.rule3.limit || 5;
    document.getElementById('stock-rule-3-color').value = settings.rule3.color || '#ff9800';
    document.getElementById('stock-rule-3-enabled').checked = settings.rule3.enabled !== false;
}

// Salvar configurações de visibilidade de estoque
function saveStockVisibilitySettings() {
    const settings = {
        rule2: {
            limit: parseInt(document.getElementById('stock-rule-2-limit').value) || 10,
            color: document.getElementById('stock-rule-2-color').value || '#ffa500',
            enabled: document.getElementById('stock-rule-2-enabled').checked
        },
        rule3: {
            limit: parseInt(document.getElementById('stock-rule-3-limit').value) || 5,
            color: document.getElementById('stock-rule-3-color').value || '#ff9800',
            enabled: document.getElementById('stock-rule-3-enabled').checked
        }
    };
    
    localStorage.setItem('stockVisibilitySettings', JSON.stringify(settings));
    alert('Configurações salvas com sucesso!');
    
    // Atualizar alerta na tela inicial se estiver visível
    if (document.getElementById('home') && document.getElementById('home').classList.contains('active')) {
        loadCriticalStockAlert();
    }
}

// Obter configurações de visibilidade de estoque
function getStockVisibilitySettings() {
    const saved = localStorage.getItem('stockVisibilitySettings');
    if (saved) {
        return JSON.parse(saved);
    }
    // Valores padrão
    return {
        rule2: {
            limit: 10,
            color: '#ffa500',
            enabled: true
        },
        rule3: {
            limit: 5,
            color: '#ff9800',
            enabled: true
        }
    };
}

// Mostrar view de visibilidade de contas a receber
function showReceivablesVisibilityView() {
    // Verificar se o usuário é administrador
    if (!isAdmin()) {
        alert('Apenas administradores podem configurar as regras de visibilidade.');
        return;
    }
    
    const settingsView = document.getElementById('inventory-settings-view');
    const receivablesVisibilityView = document.getElementById('receivables-visibility-view');
    if (settingsView) settingsView.querySelector('.settings-menu').style.display = 'none';
    if (receivablesVisibilityView) {
        receivablesVisibilityView.style.display = 'block';
        loadReceivablesVisibilitySettings();
    }
}

// Validar regra 2
function validateReceivablesRule2() {
    const rule2Input = document.getElementById('receivables-rule-2-max-days');
    const rule3Input = document.getElementById('receivables-rule-3-max-days');
    
    if (rule2Input && rule3Input) {
        const rule2Value = parseInt(rule2Input.value) || 0;
        const rule3Value = parseInt(rule3Input.value) || 0;
        
        if (rule2Value >= rule3Value) {
            rule3Input.setCustomValidity('O valor deve ser maior que o da Regra 2');
        } else {
            rule3Input.setCustomValidity('');
        }
    }
}

// Validar regra 3
function validateReceivablesRule3() {
    const rule2Input = document.getElementById('receivables-rule-2-max-days');
    const rule3Input = document.getElementById('receivables-rule-3-max-days');
    
    if (rule2Input && rule3Input) {
        const rule2Value = parseInt(rule2Input.value) || 0;
        const rule3Value = parseInt(rule3Input.value) || 0;
        
        if (rule3Value <= rule2Value) {
            rule3Input.setCustomValidity('O valor deve ser maior que o da Regra 2');
        } else {
            rule3Input.setCustomValidity('');
        }
    }
}

// Carregar configurações de visibilidade de contas a receber
function loadReceivablesVisibilitySettings() {
    const settings = getReceivablesVisibilitySettings();
    
    // Regra 1 (fixa)
    document.getElementById('receivables-rule-1-color').value = settings.rule1.color || '#ff6b6b';
    
    // Regra 2
    document.getElementById('receivables-rule-2-max-days').value = settings.rule2.maxDays || 30;
    document.getElementById('receivables-rule-2-color').value = settings.rule2.color || '#ffa500';
    document.getElementById('receivables-rule-2-enabled').checked = settings.rule2.enabled !== false;
    
    // Regra 3
    document.getElementById('receivables-rule-3-max-days').value = settings.rule3.maxDays || 180;
    document.getElementById('receivables-rule-3-color').value = settings.rule3.color || '#4caf50';
    document.getElementById('receivables-rule-3-enabled').checked = settings.rule3.enabled !== false;
    
    // Adicionar listeners para validação
    const rule2Input = document.getElementById('receivables-rule-2-max-days');
    const rule3Input = document.getElementById('receivables-rule-3-max-days');
    
    if (rule2Input) {
        rule2Input.addEventListener('change', validateReceivablesRule2);
        rule2Input.addEventListener('input', validateReceivablesRule2);
    }
    
    if (rule3Input) {
        rule3Input.addEventListener('change', validateReceivablesRule3);
        rule3Input.addEventListener('input', validateReceivablesRule3);
    }
}

// Salvar configurações de visibilidade de contas a receber
function saveReceivablesVisibilitySettings() {
    // Verificar se o usuário é administrador
    if (!isAdmin()) {
        alert('Apenas administradores podem salvar configurações.');
        return;
    }
    
    // Validar regras
    const rule2Value = parseInt(document.getElementById('receivables-rule-2-max-days').value) || 0;
    const rule3Value = parseInt(document.getElementById('receivables-rule-3-max-days').value) || 0;
    
    if (rule2Value >= rule3Value) {
        alert('O valor da Regra 3 deve ser maior que o da Regra 2.');
        return;
    }
    
    if (rule2Value < 1 || rule2Value > 90) {
        alert('A Regra 2 deve ter um valor entre 1 e 90 dias.');
        return;
    }
    
    if (rule3Value < 91 || rule3Value > 180) {
        alert('A Regra 3 deve ter um valor entre 91 e 180 dias.');
        return;
    }
    
    const settings = {
        rule1: {
            color: document.getElementById('receivables-rule-1-color').value || '#ff6b6b'
        },
        rule2: {
            maxDays: rule2Value,
            color: document.getElementById('receivables-rule-2-color').value || '#ffa500',
            enabled: document.getElementById('receivables-rule-2-enabled').checked
        },
        rule3: {
            maxDays: rule3Value,
            color: document.getElementById('receivables-rule-3-color').value || '#4caf50',
            enabled: document.getElementById('receivables-rule-3-enabled').checked
        }
    };
    
    localStorage.setItem('receivablesVisibilitySettings', JSON.stringify(settings));
    alert('Configurações salvas com sucesso!');
    
    // Atualizar alerta na tela inicial se estiver visível
    if (document.getElementById('home') && document.getElementById('home').classList.contains('active')) {
        loadReceivablesExpirationAlert();
    }
}

// Obter configurações de visibilidade de contas a receber
function getReceivablesVisibilitySettings() {
    const saved = localStorage.getItem('receivablesVisibilitySettings');
    if (saved) {
        return JSON.parse(saved);
    }
    // Valores padrão
    return {
        rule1: {
            color: '#ff6b6b'
        },
        rule2: {
            maxDays: 30,
            color: '#ffa500',
            enabled: true
        },
        rule3: {
            maxDays: 180,
            color: '#4caf50',
            enabled: true
        }
    };
}

// Calcular dias até vencimento
function getDaysUntilDue(dueDate) {
    if (!dueDate) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

// Carregar e exibir alerta de vencimento de contas a receber na tela inicial
function loadReceivablesExpirationAlert() {
    const container = document.getElementById('receivables-expiration-alert-container');
    if (!container) return;
    
    // Carregar receivables do localStorage
    receivables = JSON.parse(localStorage.getItem('receivables')) || [];
    
    // Obter configurações de regras
    const settings = getReceivablesVisibilitySettings();
    
    // Filtrar apenas contas não pagas
    const unpaidReceivables = receivables.filter(rec => {
        const amountDue = rec.amountDue || 0;
        return amountDue > 0;
    });
    
    // Agrupar contas por regra
    const receivablesByRule = {
        rule1: [], // Vencidas ou vencendo hoje (fixa, sempre ativa)
        rule2: [], // Configurável 1
        rule3: []  // Configurável 2
    };
    
    unpaidReceivables.forEach(receivable => {
        if (!receivable.dueDate) return;
        
        const daysUntilDue = getDaysUntilDue(receivable.dueDate);
        if (daysUntilDue === null) return;
        
        // Regra 1: Vencidas ou vencendo hoje (sempre verificar, tem prioridade)
        if (daysUntilDue <= 0) {
            receivablesByRule.rule1.push(receivable);
            return; // Não verificar outras regras para esta conta
        }
        
        // Regra 2: Se ativada e está dentro do range (1 até maxDays)
        if (settings.rule2.enabled && daysUntilDue >= 1 && daysUntilDue <= settings.rule2.maxDays) {
            receivablesByRule.rule2.push(receivable);
            return; // Não verificar regra 3 para esta conta
        }
        
        // Regra 3: Se ativada e está acima do maxDays da regra 2 até o maxDays da regra 3
        if (settings.rule3.enabled && daysUntilDue > settings.rule2.maxDays && daysUntilDue <= settings.rule3.maxDays) {
            receivablesByRule.rule3.push(receivable);
        }
    });
    
    // Verificar se há contas em alguma regra
    const hasReceivables = receivablesByRule.rule1.length > 0 || 
                          receivablesByRule.rule2.length > 0 || 
                          receivablesByRule.rule3.length > 0;
    
    if (!hasReceivables) {
        container.style.display = 'none';
        return;
    }
    
    // Mostrar o container
    container.style.display = 'block';
    
    // Renderizar cards por regra
    let html = '';
    
    // Regra 1: Vencidas ou vencendo hoje (card piscando)
    if (receivablesByRule.rule1.length > 0) {
        html += `
            <div class="receivables-alert-rule-group receivables-alert-pulse" data-rule="1" style="background: linear-gradient(135deg, ${settings.rule1.color} 0%, ${adjustColorBrightness(settings.rule1.color, -20)} 100%);">
                <div class="receivables-alert-rule-header">
                    <h4>⚠️ Contas Vencidas ou Vencendo Hoje</h4>
                    <span class="receivables-alert-count">${receivablesByRule.rule1.length} conta(s)</span>
                </div>
                <div class="receivables-alert-cards-grid">
                    ${receivablesByRule.rule1.map(rec => renderReceivableCard(rec)).join('')}
                </div>
            </div>
        `;
    }
    
    // Regra 2: Configurável
    if (receivablesByRule.rule2.length > 0) {
        html += `
            <div class="receivables-alert-rule-group" data-rule="2" style="background: linear-gradient(135deg, ${settings.rule2.color} 0%, ${adjustColorBrightness(settings.rule2.color, -20)} 100%);">
                <div class="receivables-alert-rule-header">
                    <h4>📅 Contas a Vencer (1 a ${settings.rule2.maxDays} dias)</h4>
                    <span class="receivables-alert-count">${receivablesByRule.rule2.length} conta(s)</span>
                </div>
                <div class="receivables-alert-cards-grid">
                    ${receivablesByRule.rule2.map(rec => renderReceivableCard(rec)).join('')}
                </div>
            </div>
        `;
    }
    
    // Regra 3: Configurável
    if (receivablesByRule.rule3.length > 0) {
        html += `
            <div class="receivables-alert-rule-group" data-rule="3" style="background: linear-gradient(135deg, ${settings.rule3.color} 0%, ${adjustColorBrightness(settings.rule3.color, -20)} 100%);">
                <div class="receivables-alert-rule-header">
                    <h4>📅 Contas a Vencer (${settings.rule2.maxDays + 1} a ${settings.rule3.maxDays} dias)</h4>
                    <span class="receivables-alert-count">${receivablesByRule.rule3.length} conta(s)</span>
                </div>
                <div class="receivables-alert-cards-grid">
                    ${receivablesByRule.rule3.map(rec => renderReceivableCard(rec)).join('')}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// Renderizar card de conta a receber
function renderReceivableCard(receivable) {
    const clientName = receivable.clientName || 'Cliente não identificado';
    const amountDue = receivable.amountDue || 0;
    const dueDate = receivable.dueDate;
    const daysUntilDue = getDaysUntilDue(dueDate);
    
    let dueDateFormatted = 'Não definida';
    let daysText = '';
    
    if (dueDate) {
        if (dueDate instanceof Date) {
            dueDateFormatted = dueDate.toLocaleDateString('pt-BR');
        } else {
            dueDateFormatted = formatDate(new Date(dueDate).toISOString());
        }
    }
    
    if (daysUntilDue !== null) {
        if (daysUntilDue < 0) {
            daysText = `${Math.abs(daysUntilDue)} dia(s) vencido(s)`;
        } else if (daysUntilDue === 0) {
            daysText = 'Vence hoje';
        } else {
            daysText = `Faltam ${daysUntilDue} dia(s)`;
        }
    }
    
    const amountFormatted = formatCurrency(amountDue);
    
    return `
        <div class="receivable-alert-card" onclick="openReceivableDetailsFromAlert('${receivable.id}')">
            <div class="receivable-alert-card-header">
                <h5>${clientName}</h5>
            </div>
            <div class="receivable-alert-card-body">
                <div class="receivable-alert-amount">${amountFormatted}</div>
                <div class="receivable-alert-date">Vencimento: ${dueDateFormatted}</div>
                <div class="receivable-alert-days">${daysText}</div>
            </div>
        </div>
    `;
}

// Abrir detalhes de conta a receber a partir do alerta da tela inicial
function openReceivableDetailsFromAlert(receivableId) {
    // Navegar para a seção de contas a receber
    showSection('inventory');
    // Aguardar um pouco para garantir que a seção foi carregada
    setTimeout(() => {
        // Mostrar a view de contas a receber
        const receivablesView = document.getElementById('inventory-receivables-view');
        if (receivablesView) {
            // Esconder outras views
            document.querySelectorAll('.inventory-view').forEach(view => {
                view.classList.remove('active');
            });
            receivablesView.classList.add('active');
            
            // Carregar lista de contas a receber
            loadReceivablesList();
            
            // Abrir modal de detalhes
            setTimeout(() => {
                openReceivableDetails(receivableId);
            }, 300);
        }
    }, 100);
}

// Carregar e exibir lista de formas de pagamento
function loadPaymentMethodsList() {
    initializePaymentMethods();
    const listContainer = document.getElementById('payment-methods-list');
    if (!listContainer) return;
    
    if (paymentMethods.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">Nenhuma forma de pagamento cadastrada.</p>';
        return;
    }
    
    listContainer.innerHTML = paymentMethods.map(method => {
        const isPixOrCash = method.name.toLowerCase() === 'pix' || method.name.toLowerCase() === 'dinheiro';
        const showDeleteButton = !isPixOrCash;
        const hasImage = method.image && method.name.toLowerCase() === 'pix';
        const isInstallment = method.name.toLowerCase() === 'crédito parcelado' || method.name.toLowerCase() === 'credito parcelado';
        const installments = method.installments || null;
        
        return `
        <div class="payment-method-card ${!method.active ? 'inactive' : ''}">
            ${hasImage ? `
            <div class="payment-method-image-container">
                <img src="${method.image}" alt="Imagem PIX" class="payment-method-image">
            </div>
            ` : ''}
            <div class="payment-method-info">
                <h3>${method.name}</h3>
                ${method.description ? `<p>${method.description}</p>` : ''}
                ${isInstallment && installments ? `<p class="payment-method-installments-info"><strong>Parcelas:</strong> até ${installments}x</p>` : ''}
                <span class="payment-method-status ${method.active ? 'active' : 'inactive'}">
                    ${method.active ? '✓ Ativa' : '✗ Inativa'}
                </span>
            </div>
            <div class="payment-method-actions">
                <button class="btn btn-edit" onclick="editPaymentMethod(${method.id})">✏️ Editar</button>
                ${showDeleteButton ? `<button class="btn btn-delete" onclick="deletePaymentMethod(${method.id})">🗑️ Excluir</button>` : ''}
            </div>
        </div>
        `;
    }).join('');
}

// Mostrar formulário para adicionar forma de pagamento
function showAddPaymentMethodForm() {
    // Limpar completamente a variável de edição
    editingPaymentMethodId = null;
    
    const formTitle = document.getElementById('payment-method-form-title');
    if (formTitle) formTitle.textContent = 'Adicionar Forma de Pagamento';
    
    // Resetar formulário completamente
    const form = document.getElementById('payment-method-form');
    if (form) {
        form.reset();
    }
    
    // Garantir que o campo ID está vazio
    const idInput = document.getElementById('payment-method-id');
    if (idInput) {
        idInput.value = '';
        idInput.removeAttribute('value');
    }
    
    const activeCheckbox = document.getElementById('payment-method-active');
    if (activeCheckbox) activeCheckbox.checked = true;
    
    // Esconder campos específicos
    const pixGroup = document.getElementById('payment-method-pix-group');
    if (pixGroup) pixGroup.style.display = 'none';
    
    const imagePreviewContainer = document.getElementById('payment-method-image-preview-container');
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
    
    const imageInput = document.getElementById('payment-method-image');
    if (imageInput) imageInput.value = '';
    
    const pixTypeInput = document.getElementById('payment-method-pix-type');
    if (pixTypeInput) {
        pixTypeInput.value = 'cpf';
        pixTypeInput.removeAttribute('required');
    }
    
    const pixKeyInput = document.getElementById('payment-method-pix-key');
    if (pixKeyInput) {
        pixKeyInput.value = '';
        pixKeyInput.removeAttribute('required');
    }
    
    const pixRecipientInput = document.getElementById('payment-method-pix-recipient');
    if (pixRecipientInput) {
        pixRecipientInput.value = '';
        pixRecipientInput.removeAttribute('required');
    }
    
    const installmentsGroup = document.getElementById('payment-method-installments-group');
    if (installmentsGroup) installmentsGroup.style.display = 'none';
    
    const installmentsInput = document.getElementById('payment-method-installments');
    if (installmentsInput) {
        installmentsInput.value = '';
        installmentsInput.removeAttribute('required');
    }
    
    // Limpar todas as flags de imagem
    window._pendingPaymentMethodImage = null;
    window._paymentMethodImageRemoved = false;
    
    // Mostrar view de registro
    showPaymentMethodsRegisterView();
}

// Editar forma de pagamento
function editPaymentMethod(id) {
    const method = paymentMethods.find(m => m.id === id);
    if (!method) return;
    
    editingPaymentMethodId = id;
    const formTitle = document.getElementById('payment-method-form-title');
    if (formTitle) formTitle.textContent = 'Editar Forma de Pagamento';
    document.getElementById('payment-method-id').value = method.id;
    document.getElementById('payment-method-name').value = method.name;
    document.getElementById('payment-method-description').value = method.description || '';
    document.getElementById('payment-method-active').checked = method.active;
    
    // Mostrar campo de imagem apenas para PIX
    const isPix = method.name.toLowerCase() === 'pix';
    const isInstallment = method.name.toLowerCase() === 'crédito parcelado' || method.name.toLowerCase() === 'credito parcelado';
    const pixGroup = document.getElementById('payment-method-pix-group');
    const imagePreviewContainer = document.getElementById('payment-method-image-preview-container');
    const imagePreview = document.getElementById('payment-method-image-preview');
    const imageInput = document.getElementById('payment-method-image');
    const installmentsGroup = document.getElementById('payment-method-installments-group');
    const installmentsInput = document.getElementById('payment-method-installments');
    
    const pixTypeInput = document.getElementById('payment-method-pix-type');
    const pixKeyInput = document.getElementById('payment-method-pix-key');
    const pixRecipientInput = document.getElementById('payment-method-pix-recipient');
    
    if (isPix) {
        pixGroup.style.display = 'block';
        if (method.image) {
            imagePreview.src = method.image;
            imagePreviewContainer.style.display = 'block';
        } else {
            imagePreviewContainer.style.display = 'none';
        }
        imageInput.value = '';
        window._pendingPaymentMethodImage = null;
        window._paymentMethodImageRemoved = false;
        if (pixTypeInput) {
            pixTypeInput.value = method.pixType || 'cpf';
            pixTypeInput.setAttribute('required', 'required');
        }
        if (pixKeyInput) {
            pixKeyInput.value = method.pixKey || '';
            pixKeyInput.setAttribute('required', 'required');
        }
        if (pixRecipientInput) {
            pixRecipientInput.value = method.pixRecipient || '';
            pixRecipientInput.setAttribute('required', 'required');
        }
    } else {
        pixGroup.style.display = 'none';
        imagePreviewContainer.style.display = 'none';
        imageInput.value = '';
        window._pendingPaymentMethodImage = null;
        window._paymentMethodImageRemoved = false;
        if (pixTypeInput) {
            pixTypeInput.value = 'cpf';
            pixTypeInput.removeAttribute('required');
        }
        if (pixKeyInput) {
            pixKeyInput.value = '';
            pixKeyInput.removeAttribute('required');
        }
        if (pixRecipientInput) {
            pixRecipientInput.value = '';
            pixRecipientInput.removeAttribute('required');
        }
    }
    
    // Mostrar campo de parcelas apenas para Crédito Parcelado
    if (isInstallment) {
        installmentsGroup.style.display = 'block';
        if (installmentsInput) {
            installmentsInput.value = method.installments || '';
            installmentsInput.setAttribute('required', 'required');
        }
    } else {
        installmentsGroup.style.display = 'none';
        if (installmentsInput) {
            installmentsInput.value = '';
            installmentsInput.removeAttribute('required');
        }
    }
    
    showPaymentMethodsRegisterView();
}

// Fechar modal de forma de pagamento
function closePaymentMethodModal() {
    document.getElementById('payment-method-modal').style.display = 'none';
    editingPaymentMethodId = null;
    window._pendingPaymentMethodImage = null;
    window._paymentMethodImageRemoved = false;
}

// Configurar event listeners para formas de pagamento
(function() {
    // Configurar delegação de eventos para o formulário
    document.addEventListener('submit', function(e) {
        if (e.target && e.target.id === 'payment-method-form') {
            e.preventDefault();
            handleSubmitPaymentMethod(e);
        }
    });
    
    // Mostrar/esconder campos específicos quando o nome mudar
    document.addEventListener('input', function(e) {
        if (e.target && e.target.id === 'payment-method-name') {
            const name = e.target.value.trim().toLowerCase();
            const pixGroup = document.getElementById('payment-method-pix-group');
            const installmentsGroup = document.getElementById('payment-method-installments-group');
            
            if (pixGroup) {
                const pixTypeInput = document.getElementById('payment-method-pix-type');
                const pixKeyInput = document.getElementById('payment-method-pix-key');
                const pixRecipientInput = document.getElementById('payment-method-pix-recipient');
                
                if (name === 'pix') {
                    pixGroup.style.display = 'block';
                    // Adicionar required quando mostrar
                    if (pixTypeInput) pixTypeInput.setAttribute('required', 'required');
                    if (pixKeyInput) pixKeyInput.setAttribute('required', 'required');
                    if (pixRecipientInput) pixRecipientInput.setAttribute('required', 'required');
                } else {
                    pixGroup.style.display = 'none';
                    // Remover required quando esconder
                    if (pixTypeInput) pixTypeInput.removeAttribute('required');
                    if (pixKeyInput) pixKeyInput.removeAttribute('required');
                    if (pixRecipientInput) pixRecipientInput.removeAttribute('required');
                    
                    const imageInput = document.getElementById('payment-method-image');
                    if (imageInput) imageInput.value = '';
                    const imagePreviewContainer = document.getElementById('payment-method-image-preview-container');
                    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
                    window._pendingPaymentMethodImage = null;
                    window._paymentMethodImageRemoved = false;
                }
            }
            
            // Campo de parcelas (Crédito Parcelado)
            if (installmentsGroup) {
                const installmentsInput = document.getElementById('payment-method-installments');
                
                if (name === 'crédito parcelado' || name === 'credito parcelado') {
                    installmentsGroup.style.display = 'block';
                    // Adicionar required quando mostrar
                    if (installmentsInput) installmentsInput.setAttribute('required', 'required');
                } else {
                    installmentsGroup.style.display = 'none';
                    // Remover required quando esconder
                    if (installmentsInput) installmentsInput.removeAttribute('required');
                    if (installmentsInput) installmentsInput.value = '';
                }
            }
        }
    });
    
    // Configurar upload de imagem
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'payment-method-image') {
            handlePaymentMethodImageUpload(e);
        }
    });
    
    // Inicializar formas de pagamento quando a aplicação estiver pronta
    setTimeout(function() {
        initializePaymentMethods();
    }, 2000);
})();

function handleSubmitPaymentMethod(event) {
    event.preventDefault();
    
    // Remover required de campos escondidos antes de validar
    const pixGroup = document.getElementById('payment-method-pix-group');
    if (pixGroup && pixGroup.style.display === 'none') {
        const pixTypeInput = document.getElementById('payment-method-pix-type');
        const pixKeyInput = document.getElementById('payment-method-pix-key');
        const pixRecipientInput = document.getElementById('payment-method-pix-recipient');
        if (pixTypeInput) pixTypeInput.removeAttribute('required');
        if (pixKeyInput) pixKeyInput.removeAttribute('required');
        if (pixRecipientInput) pixRecipientInput.removeAttribute('required');
    }
    
    const installmentsGroup = document.getElementById('payment-method-installments-group');
    if (installmentsGroup && installmentsGroup.style.display === 'none') {
        const installmentsInput = document.getElementById('payment-method-installments');
        if (installmentsInput) installmentsInput.removeAttribute('required');
    }
    
    try {
        savePaymentMethod();
    } catch (error) {
        console.error('Erro ao salvar forma de pagamento:', error);
        alert('Erro ao salvar forma de pagamento. Por favor, tente novamente.');
    }
}

function savePaymentMethod() {
    const idInput = document.getElementById('payment-method-id');
    const id = idInput ? idInput.value.trim() : '';
    const name = document.getElementById('payment-method-name').value.trim();
    const description = document.getElementById('payment-method-description').value.trim();
    const active = document.getElementById('payment-method-active').checked;
    const isPix = name.toLowerCase() === 'pix';
    const isInstallment = name.toLowerCase() === 'crédito parcelado' || name.toLowerCase() === 'credito parcelado';
    
    // Determinar se está editando - verificar tanto editingPaymentMethodId quanto o campo hidden
    const hasEditingId = editingPaymentMethodId !== null && editingPaymentMethodId !== undefined && editingPaymentMethodId !== 0;
    const hasIdField = id !== '' && id !== null && id !== undefined && id !== '0';
    const isEditing = hasEditingId || hasIdField;
    
    // Obter o ID do método (priorizar editingPaymentMethodId, depois o campo hidden)
    let methodId = null;
    if (hasEditingId) {
        methodId = editingPaymentMethodId;
    } else if (hasIdField) {
        const parsedId = parseInt(id);
        if (!isNaN(parsedId) && parsedId > 0) {
            methodId = parsedId;
        }
    }
    
    // Debug: verificar o estado
    console.log('Salvando forma de pagamento:', {
        name: name,
        isEditing: isEditing,
        editingPaymentMethodId: editingPaymentMethodId,
        idField: id,
        methodId: methodId,
        totalMethods: paymentMethods.length
    });
    
    if (!name) {
        alert('Por favor, informe o nome da forma de pagamento.');
        return;
    }
    
    // Validar parcelas para Crédito Parcelado
    let installments = null;
    if (isInstallment) {
        const installmentsValue = document.getElementById('payment-method-installments').value.trim();
        if (!installmentsValue) {
            alert('Por favor, informe a quantidade de parcelas para Crédito Parcelado.');
            return;
        }
        const installmentsNum = parseInt(installmentsValue);
        if (isNaN(installmentsNum) || installmentsNum < 1 || installmentsNum > 99) {
            alert('A quantidade de parcelas deve ser um número entre 1 e 99.');
            return;
        }
        installments = installmentsNum;
    }
    
    // Verificar se já existe outra forma de pagamento com o mesmo nome (exceto a atual)
    if (methodId) {
        // Se está editando, verificar se existe outro método com o mesmo nome (exceto o atual)
        const existingMethod = paymentMethods.find(m => 
            m.name.toLowerCase() === name.toLowerCase() && 
            m.id !== methodId
        );
        
        if (existingMethod) {
            alert('Já existe uma forma de pagamento com este nome.');
            return;
        }
    } else {
        // Se está criando novo, verificar se já existe com o mesmo nome
        const existingMethod = paymentMethods.find(m => 
            m.name.toLowerCase() === name.toLowerCase()
        );
        
        if (existingMethod) {
            alert('Já existe uma forma de pagamento com este nome.');
            return;
        }
    }
    
    // Dados de PIX
    let image = null;
    let pixType = null;
    let pixKey = null;
    let pixRecipient = null;
    if (isPix) {
        // Garantir que os campos existem antes de usar
        const pixTypeEl = document.getElementById('payment-method-pix-type');
        const pixKeyEl = document.getElementById('payment-method-pix-key');
        const pixRecipientEl = document.getElementById('payment-method-pix-recipient');

        if (!pixTypeEl || !pixKeyEl || !pixRecipientEl) {
            alert('Campos de configuração do PIX não foram encontrados na tela. Atualize a página e tente novamente.');
            return;
        }

        if (window._paymentMethodImageRemoved) {
            image = null;
        } else if (window._pendingPaymentMethodImage) {
            image = window._pendingPaymentMethodImage;
        } else if (methodId) {
            const existingMethod = paymentMethods.find(m => m.id === methodId);
            if (existingMethod && existingMethod.image) {
                image = existingMethod.image;
            }
        }

        pixType = pixTypeEl.value;
        pixKey = pixKeyEl.value.trim();
        pixRecipient = pixRecipientEl.value.trim();

        if (!pixKey || !pixRecipient) {
            alert('Informe a chave PIX e o nome do recebedor.');
            return;
        }
    } else {
        // Limpar dados de PIX se não for PIX
        image = null;
        pixType = null;
        pixKey = null;
        pixRecipient = null;
    }
    
    if (isEditing && methodId) {
        // Editar existente
        const index = paymentMethods.findIndex(m => {
            // Comparar tanto por número quanto por string para garantir compatibilidade
            return m.id === methodId || m.id === parseInt(methodId) || String(m.id) === String(methodId);
        });
        
        if (index !== -1) {
            const updatedMethod = {
                id: methodId,
                name: name,
                description: description,
                active: active
            };
            if (isPix) {
                updatedMethod.image = image;
                updatedMethod.pixType = pixType;
                updatedMethod.pixKey = pixKey;
                updatedMethod.pixRecipient = pixRecipient;
            } else {
                // Remover campos PIX se não for mais PIX
                if (updatedMethod.image !== undefined) delete updatedMethod.image;
                if (updatedMethod.pixType !== undefined) delete updatedMethod.pixType;
                if (updatedMethod.pixKey !== undefined) delete updatedMethod.pixKey;
                if (updatedMethod.pixRecipient !== undefined) delete updatedMethod.pixRecipient;
            }
            if (isInstallment) {
                updatedMethod.installments = installments;
            } else {
                if (updatedMethod.installments !== undefined) delete updatedMethod.installments;
            }
            paymentMethods[index] = updatedMethod;
        } else {
            // Se não encontrou para editar, adicionar como novo
            console.warn('Método não encontrado para editar, adicionando como novo');
            const newMethod = {
                id: Date.now(),
                name: name,
                description: description,
                active: active
            };
            if (isPix) {
                newMethod.image = image;
                newMethod.pixType = pixType;
                newMethod.pixKey = pixKey;
                newMethod.pixRecipient = pixRecipient;
            }
            if (isInstallment) {
                newMethod.installments = installments;
            }
            paymentMethods.push(newMethod);
        }
    } else {
        // Adicionar nova
        const newMethod = {
            id: Date.now(),
            name: name,
            description: description,
            active: active
        };
        if (isPix) {
            newMethod.image = image;
            newMethod.pixType = pixType;
            newMethod.pixKey = pixKey;
            newMethod.pixRecipient = pixRecipient;
        }
        if (isInstallment) {
            newMethod.installments = installments;
        }
        
        console.log('Adicionando nova forma de pagamento:', newMethod);
        paymentMethods.push(newMethod);
        console.log('Total de formas de pagamento após adicionar:', paymentMethods.length);
    }
    
    // Salvar no localStorage
    savePaymentMethods();
    
    // Verificar se foi salvo corretamente
    const savedMethods = JSON.parse(localStorage.getItem('paymentMethods') || '[]');
    console.log('Formas de pagamento salvas no localStorage:', savedMethods.length);
    
    // Recarregar a lista
    loadPaymentMethodsList();
    
    // Mostrar mensagem de sucesso
    alert(isEditing ? 'Forma de pagamento atualizada com sucesso!' : 'Forma de pagamento cadastrada com sucesso!');
    
    // Limpar flags e resetar formulário
    window._pendingPaymentMethodImage = null;
    window._paymentMethodImageRemoved = false;
    editingPaymentMethodId = null;
    
    // Resetar formulário
    const form = document.getElementById('payment-method-form');
    if (form) {
        form.reset();
    }
    
    const idInputReset = document.getElementById('payment-method-id');
    if (idInputReset) idInputReset.value = '';
    
    const activeCheckbox = document.getElementById('payment-method-active');
    if (activeCheckbox) activeCheckbox.checked = true;
    
    const pixGroup = document.getElementById('payment-method-pix-group');
    if (pixGroup) pixGroup.style.display = 'none';
    
    // Remover required dos campos PIX ao resetar
    const pixTypeInput = document.getElementById('payment-method-pix-type');
    const pixKeyInput = document.getElementById('payment-method-pix-key');
    const pixRecipientInput = document.getElementById('payment-method-pix-recipient');
    if (pixTypeInput) pixTypeInput.removeAttribute('required');
    if (pixKeyInput) pixKeyInput.removeAttribute('required');
    if (pixRecipientInput) pixRecipientInput.removeAttribute('required');
    
    const imagePreviewContainer = document.getElementById('payment-method-image-preview-container');
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
    
    const installmentsGroup = document.getElementById('payment-method-installments-group');
    if (installmentsGroup) installmentsGroup.style.display = 'none';
    
    const installmentsInput = document.getElementById('payment-method-installments');
    if (installmentsInput) installmentsInput.removeAttribute('required');
    
    // Voltar para a lista
    showPaymentMethodsList();
}

// Excluir forma de pagamento
function deletePaymentMethod(id) {
    const method = paymentMethods.find(m => m.id === id);
    if (!method) return;
    
    if (!confirm(`Tem certeza que deseja excluir a forma de pagamento "${method.name}"?`)) {
        return;
    }
    
    paymentMethods = paymentMethods.filter(m => m.id !== id);
    savePaymentMethods();
    loadPaymentMethodsList();
}

// Upload de imagem do PIX
function handlePaymentMethodImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validar tipo
    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem.');
        return;
    }
    
    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;
        window._pendingPaymentMethodImage = imageData;
        window._paymentMethodImageRemoved = false;
        
        // Mostrar preview
        const preview = document.getElementById('payment-method-image-preview');
        const previewContainer = document.getElementById('payment-method-image-preview-container');
        if (preview && previewContainer) {
            preview.src = imageData;
            previewContainer.style.display = 'block';
        }
    };
    
    reader.onerror = function() {
        alert('Erro ao carregar a imagem. Por favor, tente novamente.');
    };
    
    reader.readAsDataURL(file);
}

// Remover imagem do PIX
function removePaymentMethodImage() {
    if (confirm('Tem certeza que deseja remover a imagem do PIX?')) {
        window._pendingPaymentMethodImage = null;
        window._paymentMethodImageRemoved = true; // Marcar que a imagem foi removida
        document.getElementById('payment-method-image-preview-container').style.display = 'none';
        document.getElementById('payment-method-image').value = '';
    }
}

// ==================== FUNÇÕES DE VENDAS ====================

// Inicializar tela de vendas
function initializeSalesScreen() {
    if (currentUser) {
        document.getElementById('sale-seller').value = currentUser.name || currentUser.username || 'Usuário';
    }
    updateSalesClock();
    setInterval(updateSalesClock, 1000);
    loadPaymentMethodsForSale();
    loadCompanyLogo();
    newSale();
    // Focar no campo Código Barras após inicializar
    setTimeout(() => {
        const barcodeField = document.getElementById('sale-barcode');
        if (barcodeField) {
            barcodeField.focus();
        }
    }, 100);
}

// Maximizar tela de vendas
function maximizeSalesScreen() {
    const salesSection = document.querySelector('.sales-section');
    if (salesSection) {
        const element = salesSection;
        if (element.requestFullscreen) {
            element.requestFullscreen().catch(err => console.log(err));
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }
}

// Atualizar relógio na tela de vendas
function updateSalesClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR');
    const clockEl = document.getElementById('sales-clock');
    if (clockEl) clockEl.textContent = time;
}

// Carregar logo da empresa
function loadCompanyLogo() {
    const logoImg = document.getElementById('sales-company-logo');
    const logoVideo = document.getElementById('sales-company-logo-video');
    const placeholderEl = document.getElementById('sales-logo-placeholder');
    
    if (companyData.logo) {
        // Detectar tipo automaticamente se não estiver definido
        let logoType = companyData.logoType;
        if (!logoType) {
            if (companyData.logo.startsWith('data:video/')) {
                logoType = 'video';
                companyData.logoType = 'video';
            } else {
                logoType = 'image';
                companyData.logoType = 'image';
            }
        }
        
        if (logoType === 'video') {
            // Mostrar vídeo
            if (logoVideo) {
                logoVideo.src = companyData.logo;
                logoVideo.style.display = 'block';
            }
            if (logoImg) {
                logoImg.style.display = 'none';
            }
        } else {
            // Mostrar imagem
            if (logoImg) {
                logoImg.src = companyData.logo;
                logoImg.style.display = 'block';
            }
            if (logoVideo) {
                logoVideo.style.display = 'none';
            }
        }
        
        if (placeholderEl) placeholderEl.style.display = 'none';
    } else {
        // Esconder ambos se não houver logo
        if (logoImg) logoImg.style.display = 'none';
        if (logoVideo) logoVideo.style.display = 'none';
        
        if (placeholderEl) {
            placeholderEl.style.display = 'block';
            placeholderEl.innerHTML = 'USIC<br>COMPOSITOR<br>MAICON COUTINHO';
        }
    }
}

function updatePaymentLogo() {
    const pixData = getPixPaymentData();
    if (pixData) {
        showPixPayment(pixData);
    } else {
        hidePixPayment();
    }
}

// Carregar formas de pagamento para a venda
function loadPaymentMethodsForSale() {
    initializePaymentMethods();
    const activeMethods = paymentMethods.filter(m => m.active);
    const select1 = document.getElementById('payment-method-1');
    const select2 = document.getElementById('payment-method-2');
    
    [select1, select2].forEach(select => {
        if (select) {
            select.innerHTML = '<option value="">Selecione...</option>';
            activeMethods.forEach(method => {
                const option = document.createElement('option');
                option.value = method.name;
                option.textContent = method.name;
                select.appendChild(option);
            });
        }
    });
    updatePaymentLogo();
}

// Nova venda
function newSale() {
    const saleNumber = generateSaleNumber();
    const now = new Date();
    const saleDate = now.toLocaleString('pt-BR');
    
    isProductSearchOpen = false;
    isClientSearchOpen = false;
    updateSalePanelVisibility();
    
    currentSale = {
        id: Date.now(),
        number: saleNumber,
        date: saleDate,
        client: null,
        clientName: 'CLIENTE PADRÃO',
        seller: currentUser ? (currentUser.name || currentUser.username) : 'Usuário',
        items: [],
        paymentMethod1: '',
        paymentValue1: 0,
        paymentMethod2: '',
        paymentValue2: 0,
        installments1: null,
        installmentValue1: null,
        installments2: null,
        installmentValue2: null,
        discount: 0,
        status: 'open',
        createdAt: now.toISOString(),
        dueDate: null,
        installments: null,
        interest: 0,
        interestType: 'percent'
    };
    
    // Resetar desconto global
    globalDiscount = 0;
    discountType = 'percent';
    const toggle = document.getElementById('discount-type-toggle');
    if (toggle) {
        toggle.checked = false;
    }
    updateDiscountLabel();
    
    document.getElementById('sale-number').value = saleNumber;
    document.getElementById('sale-date').value = saleDate;
    document.getElementById('sale-client').value = 'CLIENTE PADRÃO';
    document.getElementById('sale-seller').value = currentSale.seller;
    document.getElementById('sale-quantity').value = 1;
    document.getElementById('sale-description').value = '';
    document.getElementById('sale-barcode').value = '';
    document.getElementById('sale-unit-value').value = '';
    document.getElementById('sale-discount').value = 0;
    // Limpar campos de venda a prazo
    const creditFields = document.getElementById('credit-payment-fields');
    if (creditFields) creditFields.style.display = 'none';
    document.getElementById('sale-due-date').value = '';
    document.getElementById('sale-installments').value = '1';
    document.getElementById('sale-interest').value = '0';
    const interestToggle = document.getElementById('interest-type-toggle');
    if (interestToggle) interestToggle.checked = false;
    updateInterestLabel();
    document.getElementById('payment-method-1').value = '';
    document.getElementById('payment-value-1').value = '';
    const paymentValue1 = document.getElementById('payment-value-1');
    if (paymentValue1) {
        paymentValue1.disabled = false;
        paymentValue1.style.backgroundColor = '';
        paymentValue1.style.cursor = '';
    }
    
    document.getElementById('payment-method-2').value = '';
    document.getElementById('payment-value-2').value = '';
    const paymentValue2 = document.getElementById('payment-value-2');
    if (paymentValue2) {
        paymentValue2.disabled = false;
        paymentValue2.style.backgroundColor = '';
        paymentValue2.style.cursor = '';
    }
    updatePaymentLogo();
    
    updateSaleItemsList();
    calculateTotals();
    
    // Focar no campo Código Barras após criar nova venda
    setTimeout(() => {
        const barcodeField = document.getElementById('sale-barcode');
        if (barcodeField) {
            barcodeField.focus();
            barcodeField.select();
        }
    }, 100);
}

// Gerar número da venda
function generateSaleNumber() {
    const lastSale = sales.length > 0 ? sales[sales.length - 1] : null;
    if (lastSale && lastSale.number) {
        const num = parseInt(lastSale.number) || 0;
        return String(num + 1).padStart(6, '0');
    }
    return '000001';
}

// Buscar produto por descrição
function searchProductByDescription(event) {
    if (event.key === 'Enter') {
        const description = event.target.value.trim();
        if (!description) return;
        
        const product = products.find(p => 
            (p.nome && p.nome.toLowerCase().includes(description.toLowerCase())) ||
            (p.name && p.name.toLowerCase().includes(description.toLowerCase())) ||
            (p.descricao && p.descricao.toLowerCase().includes(description.toLowerCase())) ||
            (p.description && p.description.toLowerCase().includes(description.toLowerCase()))
        );
        
        if (product) {
            addProductToSale(product);
        } else {
            alert('Produto não encontrado!');
        }
    }
}


// Handler para Enter no código de barras
function handleBarcodeEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const barcode = event.target.value.trim();
        if (!barcode) return;
        
        if (barcode === '1') {
            document.getElementById('sale-description').value = 'DIVERSOS';
            document.getElementById('sale-barcode').value = '';
            document.getElementById('sale-unit-value').value = '';
            document.getElementById('sale-quantity').value = 1;
            setTimeout(() => {
                const unitField = document.getElementById('sale-unit-value');
                if (unitField) {
                    unitField.focus();
                    unitField.select();
                }
            }, 50);
            return;
        }
        
        const product = findProductByBarcode(barcode);
        if (product) {
            // Ler a quantidade ANTES de preencher os campos (para não perder o valor)
            const currentQuantity = parseFloat(document.getElementById('sale-quantity').value) || 1;
            fillSaleFieldsForProduct(product);
            // Restaurar a quantidade que estava no campo antes de preencher
            document.getElementById('sale-quantity').value = currentQuantity;
            addProductToSale(product);
        } else {
            alert('Produto não encontrado!');
            event.target.select();
        }
    }
}

// Verificar estoque e solicitar confirmação se necessário
// requestedQuantity: quantidade total do produto na venda (soma de todos os itens com o mesmo productId)
function checkStockAndConfirm(product, requestedQuantity) {
    // Se não há produto ou não tem ID, não precisa verificar estoque
    if (!product || !product.id) {
        return true;
    }
    
    // Buscar produto atualizado do array de produtos
    const currentProduct = products.find(p => p.id === product.id);
    if (!currentProduct) {
        return true; // Produto não encontrado, permitir continuar
    }
    
    const currentStock = currentProduct.quantidadeEstoque || 0;
    
    // Se a quantidade total solicitada é maior que o estoque, mostrar alerta
    if (requestedQuantity > currentStock) {
        const message = `A quantidade solicitada (${requestedQuantity}) é maior que o estoque atual (${currentStock}). Deseja incluir o produto no pedido, resultando em estoque negativo?`;
        return confirm(message);
    }
    
    return true;
}

// Adicionar produto à venda
function addProductToSale(product) {
    if (!currentSale) newSale();
    
    const quantity = parseFloat(document.getElementById('sale-quantity').value) || 1;
    
    // Calcular quantidade total do produto na venda (soma de todos os itens com o mesmo productId)
    let totalQuantityInSale = quantity;
    if (product && product.id && currentSale && currentSale.items) {
        const existingItems = currentSale.items.filter(item => item.productId === product.id);
        const existingQuantity = existingItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
        totalQuantityInSale = existingQuantity + quantity;
    }
    
    // Validar estoque antes de adicionar (usando quantidade total)
    if (!checkStockAndConfirm(product, totalQuantityInSale)) {
        return; // Usuário cancelou a inclusão
    }
    // Usar campos corretos: precoVenda ou salePrice
    const precoVenda = product ? (product.precoVenda || product.salePrice || 0) : 0;
    const unitValue = parseFloat(document.getElementById('sale-unit-value').value) || precoVenda;
    const discount = parseFloat(document.getElementById('sale-discount').value) || 0;
    
    // Usar campos corretos: nome ou name, descricao ou description
    const nomeProduto = product ? (product.nome || product.name || 'DIVERSOS') : 'DIVERSOS';
    const descricaoProduto = product ? (product.descricao || product.description || '') : '';
    
    // Calcular total do item baseado no tipo de desconto atual
    let itemTotal = unitValue * quantity;
    if (discount > 0) {
        if (discountType === 'percent') {
            // Desconto percentual
            itemTotal = itemTotal * (1 - discount / 100);
        } else {
            // Desconto em reais (aplicado sobre o total do item)
            itemTotal = itemTotal - discount;
        }
    }
    // Garantir que não fique negativo
    itemTotal = Math.max(0, itemTotal);
    
    const item = {
        id: Date.now(),
        productId: product ? product.id : null,
        name: nomeProduto,
        description: descricaoProduto,
        quantity: quantity,
        unitValue: unitValue,
        discount: discount,
        discountType: discountType, // Armazenar o tipo de desconto usado
        total: itemTotal
    };
    
    currentSale.items.push(item);
    saleItemIndex = -1; // Reset seleção
    
    // Limpar campos (zerar desconto após adicionar item)
    document.getElementById('sale-quantity').value = 1;
    document.getElementById('sale-description').value = '';
    document.getElementById('sale-barcode').value = '';
    document.getElementById('sale-unit-value').value = '';
    document.getElementById('sale-discount').value = 0;
    // Zerar desconto global também quando adicionar item (para não afetar o total)
    globalDiscount = 0;
    
    focusDescriptionField();
    
    // Atualizar imagem do produto (usar campo imagem ou image)
    const imagemProduto = product ? (product.imagem || product.image || '') : '';
    if (product && imagemProduto) {
        document.getElementById('sale-product-img').src = imagemProduto;
        document.getElementById('sale-product-img').style.display = 'block';
        document.getElementById('sale-product-img-placeholder').style.display = 'none';
    } else {
        document.getElementById('sale-product-img').style.display = 'none';
        document.getElementById('sale-product-img-placeholder').style.display = 'block';
    }
    
    updateSaleItemsList();
    calculateTotals();
    // Focar no campo Código Barras após adicionar
    setTimeout(() => {
        const barcodeField = document.getElementById('sale-barcode');
        if (barcodeField) {
            barcodeField.focus();
        }
    }, 100);
}

// Atualizar lista de itens da venda
function updateSaleItemsList() {
    const container = document.getElementById('sale-items-container');
    if (!container) return;
    
    if (!currentSale || currentSale.items.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhum item adicionado</p>';
        return;
    }
    
    // Atualizar lista no centro (Itens da Venda)
    container.innerHTML = currentSale.items.map((item, index) => {
        const isSelected = saleItemIndex === index;
        // Determinar o tipo de desconto do item (usar o armazenado ou o atual)
        const itemDiscountType = item.discountType || discountType;
        const discountDisplay = item.discount > 0 
            ? (itemDiscountType === 'percent' 
                ? `Desc: ${item.discount}%` 
                : `Desc: R$ ${item.discount.toFixed(2)}`)
            : '';
        
        return `
        <div class="sale-item ${isSelected ? 'sale-item-selected' : ''}" onclick="selectSaleItem(${index})">
            <div class="sale-item-info">
                <strong>${item.name || 'DIVERSOS'}</strong>
                <span>Qtd: ${item.quantity} x R$ ${item.unitValue.toFixed(2)}</span>
                ${discountDisplay ? `<span class="discount-badge">${discountDisplay}</span>` : ''}
            </div>
            <div class="sale-item-total">R$ ${item.total.toFixed(2)}</div>
        </div>
    `;
    }).join('');
}

// Selecionar item da venda
function selectSaleItem(index) {
    // Permitir selecionar item (mesmo sem permissão de edição, pode ter permissão para excluir)
    saleItemIndex = index;
    const item = currentSale.items[index];
    document.getElementById('sale-quantity').value = item.quantity;
    document.getElementById('sale-description').value = item.name;
    document.getElementById('sale-unit-value').value = item.unitValue;
    document.getElementById('sale-discount').value = item.discount;
    
    // Atualizar o tipo de desconto global e o toggle para refletir o tipo do item selecionado
    if (item.discountType) {
        discountType = item.discountType;
        const toggle = document.getElementById('discount-type-toggle');
        toggle.checked = (discountType === 'real');
        updateDiscountLabel();
    }
    
    // Atualizar visual para mostrar item selecionado
    updateSaleItemsList();
    // Focar no campo de quantidade após selecionar
    setTimeout(() => {
        document.getElementById('sale-quantity').focus();
        document.getElementById('sale-quantity').select();
    }, 100);
}

// Calcular total do item
function calculateItemTotal() {
    // Esta função recalcula o total do item quando o desconto ou valor unitário mudam
    if (saleItemIndex >= 0 && currentSale && currentSale.items[saleItemIndex]) {
        const item = currentSale.items[saleItemIndex];
        const quantity = parseFloat(document.getElementById('sale-quantity').value) || item.quantity;
        const unitValue = parseFloat(document.getElementById('sale-unit-value').value) || item.unitValue;
        const discount = parseFloat(document.getElementById('sale-discount').value) || 0;
        
        // Verificar se houve alteração nos valores
        const quantityChanged = quantity !== item.quantity;
        const unitValueChanged = unitValue !== item.unitValue;
        const discountChanged = discount !== item.discount;
        
        // Verificar permissão para editar item (apenas quando tentar alterar valores)
        if ((quantityChanged || unitValueChanged || discountChanged) && !hasSalesPermission('vender_editarItem')) {
            // Restaurar valores originais do item
            document.getElementById('sale-quantity').value = item.quantity;
            document.getElementById('sale-unit-value').value = item.unitValue;
            document.getElementById('sale-discount').value = item.discount;
            alert('⚠️ Você não tem permissão para editar itens da venda.');
            return;
        }
        
        // Validar estoque se há um produto associado
        if (item.productId) {
            // Calcular quantidade total do produto na venda (soma de todos os itens com o mesmo productId)
            let totalQuantityInSale = quantity;
            if (currentSale && currentSale.items) {
                const existingItems = currentSale.items.filter(i => i.productId === item.productId && i.id !== item.id);
                const existingQuantity = existingItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
                totalQuantityInSale = existingQuantity + quantity;
            }
            
            const product = products.find(p => p.id === item.productId);
            if (product && !checkStockAndConfirm(product, totalQuantityInSale)) {
                // Usuário cancelou, restaurar quantidade anterior
                document.getElementById('sale-quantity').value = item.quantity;
                return;
            }
        }
        
        // Sempre usar o tipo de desconto atual (permitir alteração do tipo de desconto)
        const itemDiscountType = discountType;
        
        // Calcular total baseado no tipo de desconto atual
        let itemTotal = unitValue * quantity;
        if (discount > 0) {
            if (itemDiscountType === 'percent') {
                itemTotal = itemTotal * (1 - discount / 100);
            } else {
                itemTotal = itemTotal - discount;
            }
        }
        itemTotal = Math.max(0, itemTotal);
        
        // Atualizar item com os novos valores
        item.quantity = quantity;
        item.unitValue = unitValue;
        item.discount = discount;
        // Sempre atualizar o tipo de desconto para permitir alteração
        item.discountType = discountType;
        item.total = itemTotal;
        
        updateSaleItemsList();
        calculateTotals();
    }
}

// Calcular totais da venda
function calculateTotals() {
    if (!currentSale) return;
    
    // Calcular total bruto (soma dos valores unitários * quantidade, sem descontos)
    const totalGross = currentSale.items.reduce((sum, item) => {
        return sum + (item.unitValue * item.quantity);
    }, 0);
    
    // Calcular total com descontos individuais dos itens
    const totalWithItemDiscounts = currentSale.items.reduce((sum, item) => {
        return sum + item.total;
    }, 0);
    
    // Calcular desconto total sobre os itens (diferença entre bruto e com descontos individuais)
    const totalDiscountOnItems = totalGross - totalWithItemDiscounts;
    
    const totalItems = currentSale.items.reduce((sum, item) => sum + item.quantity, 0);
    
    // Aplicar desconto global sobre o total COM descontos individuais já aplicados
    let totalLiquid = totalWithItemDiscounts;
    let totalDiscountOnLiquid = 0;
    
    if (globalDiscount > 0) {
        if (discountType === 'percent') {
            // Desconto percentual: aplica % sobre o total com descontos individuais
            totalDiscountOnLiquid = totalWithItemDiscounts * (globalDiscount / 100);
            totalLiquid = totalWithItemDiscounts * (1 - globalDiscount / 100);
        } else {
            // Desconto em reais: subtrai valor em R$ do total com descontos individuais
            totalDiscountOnLiquid = globalDiscount;
            totalLiquid = totalWithItemDiscounts - globalDiscount;
        }
    }
    // Garantir que não fique negativo
    totalLiquid = Math.max(0, totalLiquid);
    totalDiscountOnLiquid = Math.max(0, totalDiscountOnLiquid);
    
    const payment1 = parseFloat(document.getElementById('payment-value-1').value) || 0;
    const payment2 = parseFloat(document.getElementById('payment-value-2').value) || 0;
    const totalPaid = payment1 + payment2;
    
    document.getElementById('total-gross').value = formatCurrency(totalGross);
    document.getElementById('total-items').value = totalItems;
    
    currentTotalLiquid = totalLiquid;
    currentTotalPaid = totalPaid;
    currentRemainingTotal = Math.max(0, totalLiquid - totalPaid);
    updateTotalDisplay(totalLiquid, totalPaid);
    
    // Atualizar card de descontos totais
    const discountCard = document.getElementById('discount-total-card');
    const discountItemsTotal = document.getElementById('discount-items-total');
    const discountLiquidTotal = document.getElementById('discount-liquid-total');
    
    // Mostrar card apenas se houver algum desconto
    if (totalDiscountOnItems > 0 || totalDiscountOnLiquid > 0) {
        discountCard.style.display = 'flex';
        
        // Formatar desconto sobre itens
        if (totalDiscountOnItems > 0) {
            discountItemsTotal.textContent = `Sobre itens: ${formatCurrency(totalDiscountOnItems)}`;
        } else {
            discountItemsTotal.textContent = `Sobre itens: R$ 0,00`;
        }
        
        // Formatar desconto sobre total líquido
        if (totalDiscountOnLiquid > 0) {
            const discountTypeText = discountType === 'percent' ? '%' : 'R$';
            discountLiquidTotal.textContent = `Sobre total líquido: ${formatCurrency(totalDiscountOnLiquid)}`;
        } else {
            discountLiquidTotal.textContent = `Sobre total líquido: R$ 0,00`;
        }
    } else {
        discountCard.style.display = 'none';
    }
    
    updatePaymentLogo();
    
    // Atualizar limites dos campos de pagamento
    updatePaymentFieldsLimits();
}

// Validar valor de pagamento ao digitar
function validatePaymentValue(index) {
    const paymentValueInput = document.getElementById(`payment-value-${index}`);
    const paymentMethodSelect = document.getElementById(`payment-method-${index}`);
    
    if (!paymentValueInput || !paymentMethodSelect) return;
    
    // Se o campo estiver bloqueado (parcelamento), não validar
    if (paymentValueInput.disabled) return;
    
    const selectedMethod = paymentMethodSelect.value || '';
    const isDinheiro = selectedMethod.toLowerCase() === 'dinheiro';
    const inputValue = parseFloat(paymentValueInput.value) || 0;
    
    // Para Dinheiro, não validar máximo (permite troco)
    if (isDinheiro) {
        return;
    }
    
    // Calcular total líquido
    if (!currentSale) return;
    
    const totalGross = currentSale.items.reduce((sum, item) => {
        return sum + (item.unitValue * item.quantity);
    }, 0);
    
    const totalWithItemDiscounts = currentSale.items.reduce((sum, item) => {
        return sum + item.total;
    }, 0);
    
    let totalLiquid = totalWithItemDiscounts;
    if (globalDiscount > 0) {
        if (discountType === 'percent') {
            totalLiquid = totalWithItemDiscounts * (1 - globalDiscount / 100);
        } else {
            totalLiquid = totalWithItemDiscounts - globalDiscount;
        }
    }
    totalLiquid = Math.max(0, totalLiquid);
    
    // Calcular valores já pagos (exceto o campo atual)
    const payment1 = index === 1 ? 0 : (parseFloat(document.getElementById('payment-value-1').value) || 0);
    const payment2 = index === 2 ? 0 : (parseFloat(document.getElementById('payment-value-2').value) || 0);
    const otherPayments = payment1 + payment2;
    
    // Calcular o que falta pagar
    const remaining = Math.max(0, totalLiquid - otherPayments);
    
    // Validar se o valor excede o que falta pagar
    if (inputValue > remaining) {
        alert(`O valor informado (${formatCurrency(inputValue)}) excede o valor que falta pagar (${formatCurrency(remaining)}).`);
        paymentValueInput.value = remaining.toFixed(2);
    }
}

function updateTotalDisplay(totalLiquid, totalPaid) {
    const totalDisplay = document.getElementById('total-display');
    const totalLabel = document.getElementById('total-display-label');
    const totalValue = document.getElementById('total-liquid');
    const totalPaidValue = document.getElementById('total-paid-value');
    if (!totalDisplay || !totalLabel || !totalValue) return;
    
    const hasItems = currentSale && currentSale.items && currentSale.items.length > 0;
    totalDisplay.classList.remove('total-display-red', 'total-display-blue');
    
    if (totalPaidValue) {
        totalPaidValue.textContent = formatCurrency(totalPaid);
    }
    
    if (totalPaid > totalLiquid && hasItems) {
        const troco = totalPaid - totalLiquid;
        totalLabel.textContent = 'TOTAL TROCO';
        totalValue.textContent = formatCurrency(Math.max(0, troco));
        totalDisplay.classList.add('total-display-blue');
    } else {
        totalLabel.textContent = 'Total a Pagar';
        const displayValue = hasItems ? Math.max(0, totalLiquid - totalPaid) : 0;
        totalValue.textContent = formatCurrency(displayValue);
        if (hasItems && displayValue > 0) {
            totalDisplay.classList.add('total-display-red');
        } else {
            totalDisplay.classList.add('total-display-blue');
        }
    }
}

// Atualizar forma de pagamento
// Variáveis para controle de parcelamento
let currentInstallmentPaymentIndex = null; // 1 ou 2
let pendingInstallmentData = null; // Dados do parcelamento pendente

function updatePaymentMethod(index) {
    // Verificar permissão para alterar forma de pagamento
    if (!hasSalesPermission('formaPagamento_alterar')) {
        alert('⚠️ Você não tem permissão para alterar a forma de pagamento.');
        // Restaurar valor anterior
        const selectElement = document.getElementById(`payment-method-${index}`);
        if (selectElement && currentSale) {
            if (index === 1) {
                selectElement.value = currentSale.paymentMethod1 || '';
            } else if (index === 2) {
                selectElement.value = currentSale.paymentMethod2 || '';
            }
        }
        return;
    }
    
    const selectElement = document.getElementById(`payment-method-${index}`);
    const selectedMethod = selectElement ? selectElement.value : '';
    
    // Verificar se é "A Prazo" e mostrar/ocultar campos
    const isAPrazo = selectedMethod && selectedMethod.toLowerCase().includes('a prazo');
    const creditFields = document.getElementById('credit-payment-fields');
    if (creditFields) {
        creditFields.style.display = isAPrazo ? 'block' : 'none';
    }
    
    // Se não for "A Prazo", limpar campos
    if (!isAPrazo) {
        document.getElementById('sale-due-date').value = '';
        document.getElementById('sale-installments').value = '1';
        document.getElementById('sale-interest').value = '0';
        const interestToggle = document.getElementById('interest-type-toggle');
        if (interestToggle) interestToggle.checked = false;
        updateInterestLabel();
    } else {
        // Se for "A Prazo", definir data padrão (30 dias)
        const dueDateInput = document.getElementById('sale-due-date');
        if (dueDateInput && !dueDateInput.value) {
            const today = new Date();
            today.setDate(today.getDate() + 30);
            dueDateInput.value = today.toISOString().split('T')[0];
        }
    }
    
    // Verificar se é Crédito Parcelado
    if (selectedMethod && (selectedMethod.toLowerCase().includes('crédito parcelado') || 
                           selectedMethod.toLowerCase().includes('credito parcelado'))) {
        // Buscar método de pagamento para obter número máximo de parcelas
        const paymentMethod = paymentMethods.find(m => 
            m.name.toLowerCase() === selectedMethod.toLowerCase() && m.active
        );
        
        const maxInstallments = paymentMethod ? (paymentMethod.installments || 12) : 12;
        
        // Armazenar índice do pagamento atual
        currentInstallmentPaymentIndex = index;
        
        // Limpar dados pendentes anteriores
        pendingInstallmentData = null;
        
        // Mostrar modal de parcelamento
        openInstallmentModal(maxInstallments);
    } else {
        // Se não for Crédito Parcelado, limpar dados de parcelamento para este índice
        if (currentSale) {
            if (index === 1) {
                currentSale.installments1 = null;
                currentSale.installmentValue1 = null;
            } else if (index === 2) {
                currentSale.installments2 = null;
                currentSale.installmentValue2 = null;
            }
        }
        
        // Desbloquear campo de valor ao alterar forma de pagamento
        const paymentValueInput = document.getElementById(`payment-value-${index}`);
        if (paymentValueInput) {
            paymentValueInput.disabled = false;
            paymentValueInput.style.backgroundColor = '';
            paymentValueInput.style.cursor = '';
        }
        
    calculateTotals();
    }
    
    // Se a seleção foi limpa (valor vazio), também limpar parcelamento
    if (!selectedMethod && currentSale) {
        if (index === 1) {
            currentSale.installments1 = null;
            currentSale.installmentValue1 = null;
        } else if (index === 2) {
            currentSale.installments2 = null;
            currentSale.installmentValue2 = null;
        }
        
        // Desbloquear campo de valor
        const paymentValueInput = document.getElementById(`payment-value-${index}`);
        if (paymentValueInput) {
            paymentValueInput.disabled = false;
            paymentValueInput.style.backgroundColor = '';
            paymentValueInput.style.cursor = '';
        }
    }
    
    // Atualizar limites dos campos de pagamento
    updatePaymentFieldsLimits();
}

// Atualizar limites dos campos de pagamento
function updatePaymentFieldsLimits() {
    if (!currentSale) return;
    
    // Calcular total líquido
    const totalGross = currentSale.items.reduce((sum, item) => {
        return sum + (item.unitValue * item.quantity);
    }, 0);
    
    const totalWithItemDiscounts = currentSale.items.reduce((sum, item) => {
        return sum + item.total;
    }, 0);
    
    let totalLiquid = totalWithItemDiscounts;
    if (globalDiscount > 0) {
        if (discountType === 'percent') {
            totalLiquid = totalWithItemDiscounts * (1 - globalDiscount / 100);
        } else {
            totalLiquid = totalWithItemDiscounts - globalDiscount;
        }
    }
    totalLiquid = Math.max(0, totalLiquid);
    
    // Atualizar limites para cada campo de pagamento
    [1, 2].forEach(index => {
        const paymentMethodSelect = document.getElementById(`payment-method-${index}`);
        const paymentValueInput = document.getElementById(`payment-value-${index}`);
        
        if (!paymentMethodSelect || !paymentValueInput) return;
        
        const selectedMethod = paymentMethodSelect.value || '';
        const isDinheiro = selectedMethod.toLowerCase() === 'dinheiro';
        
        // Se o campo estiver bloqueado (parcelamento), não atualizar
        if (paymentValueInput.disabled) {
            return;
        }
        
        // Calcular valores já pagos (exceto o campo atual)
        const payment1 = index === 1 ? 0 : (parseFloat(document.getElementById('payment-value-1').value) || 0);
        const payment2 = index === 2 ? 0 : (parseFloat(document.getElementById('payment-value-2').value) || 0);
        const otherPayments = payment1 + payment2;
        
        // Calcular o que falta pagar
        const remaining = Math.max(0, totalLiquid - otherPayments);
        
        // Para Dinheiro, não definir máximo (permite troco)
        if (isDinheiro) {
            paymentValueInput.removeAttribute('max');
        } else {
            // Para outras formas, limitar ao que falta pagar
            paymentValueInput.setAttribute('max', remaining.toFixed(2));
        }
    });
}

// Abrir modal de parcelamento
function openInstallmentModal(maxInstallments) {
    const modal = document.getElementById('installment-modal');
    const maxValueSpan = document.getElementById('installment-max-value');
    const quantityInput = document.getElementById('installment-quantity');
    
    if (!modal) return;
    
    // Atualizar valor máximo
    if (maxValueSpan) {
        maxValueSpan.textContent = maxInstallments;
    }
    
    // Configurar max do input
    if (quantityInput) {
        quantityInput.max = maxInstallments;
        quantityInput.value = '';
    }
    
    // Limpar campo de valor
    const valueInput = document.getElementById('installment-value');
    if (valueInput) {
        valueInput.value = '';
    }
    
    // Mostrar modal
    modal.style.display = 'block';
    
    // Focar no campo de quantidade
    setTimeout(() => {
        if (quantityInput) {
            quantityInput.focus();
        }
    }, 100);
}

// Fechar modal de parcelamento
function closeInstallmentModal(clearFields = true) {
    const modal = document.getElementById('installment-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Se cancelou (clearFields = true), limpar seleção do método de pagamento e desbloquear campo
    if (clearFields && currentInstallmentPaymentIndex) {
        const selectElement = document.getElementById(`payment-method-${currentInstallmentPaymentIndex}`);
        if (selectElement) {
            selectElement.value = '';
        }
        
        // Desbloquear campo de valor
        const paymentValueInput = document.getElementById(`payment-value-${currentInstallmentPaymentIndex}`);
        if (paymentValueInput) {
            paymentValueInput.disabled = false;
            paymentValueInput.style.backgroundColor = '';
            paymentValueInput.style.cursor = '';
            paymentValueInput.value = '';
        }
        
        currentInstallmentPaymentIndex = null;
    } else if (!clearFields) {
        // Se não for para limpar, apenas limpar o índice sem tocar nos campos
        currentInstallmentPaymentIndex = null;
    }
    
    pendingInstallmentData = null;
}

// Processar formulário de parcelamento
function handleInstallmentSubmit(event) {
    event.preventDefault();
    
    if (!currentInstallmentPaymentIndex) {
        alert('Erro: Índice de pagamento não identificado.');
        closeInstallmentModal();
        return;
    }
    
    const quantity = parseInt(document.getElementById('installment-quantity').value);
    const value = parseFloat(document.getElementById('installment-value').value);
    
    // Validar quantidade
    const selectElement = document.getElementById(`payment-method-${currentInstallmentPaymentIndex}`);
    const selectedMethod = selectElement ? selectElement.value : '';
    const paymentMethod = paymentMethods.find(m => 
        m.name.toLowerCase() === selectedMethod.toLowerCase() && m.active
    );
    const maxInstallments = paymentMethod ? (paymentMethod.installments || 12) : 12;
    
    if (isNaN(quantity) || quantity < 1 || quantity > maxInstallments) {
        alert(`A quantidade de parcelas deve ser um número entre 1 e ${maxInstallments}.`);
        return;
    }
    
    // Validar valor
    if (isNaN(value) || value <= 0) {
        alert('Por favor, informe um valor válido maior que zero.');
        return;
    }
    
    // Calcular total líquido para validar valor máximo
    if (!currentSale) {
        newSale();
    }
    
    // Calcular total líquido
    const totalGross = currentSale.items.reduce((sum, item) => {
        return sum + (item.unitValue * item.quantity);
    }, 0);
    
    const totalWithItemDiscounts = currentSale.items.reduce((sum, item) => {
        return sum + item.total;
    }, 0);
    
    let totalLiquid = totalWithItemDiscounts;
    if (globalDiscount > 0) {
        if (discountType === 'percent') {
            totalLiquid = totalWithItemDiscounts * (1 - globalDiscount / 100);
        } else {
            totalLiquid = totalWithItemDiscounts - globalDiscount;
        }
    }
    totalLiquid = Math.max(0, totalLiquid);
    
    // Calcular valores já pagos (exceto o campo atual)
    const payment1 = currentInstallmentPaymentIndex === 1 ? 0 : (parseFloat(document.getElementById('payment-value-1').value) || 0);
    const payment2 = currentInstallmentPaymentIndex === 2 ? 0 : (parseFloat(document.getElementById('payment-value-2').value) || 0);
    const otherPayments = payment1 + payment2;
    
    // Calcular o que falta pagar
    const remaining = Math.max(0, totalLiquid - otherPayments);
    
    // Validar se o valor não excede o que falta pagar
    if (value > remaining) {
        alert(`O valor informado (${formatCurrency(value)}) não pode ser maior que o valor que falta pagar (${formatCurrency(remaining)}).`);
        document.getElementById('installment-value').value = remaining.toFixed(2);
        document.getElementById('installment-value').focus();
        return;
    }
    
    // Armazenar dados de parcelamento na venda
    
    if (currentInstallmentPaymentIndex === 1) {
        currentSale.installments1 = quantity;
        currentSale.installmentValue1 = value;
    } else if (currentInstallmentPaymentIndex === 2) {
        currentSale.installments2 = quantity;
        currentSale.installmentValue2 = value;
    }
    
    // Definir o valor do pagamento ANTES de fechar o modal
    const paymentValueInput = document.getElementById(`payment-value-${currentInstallmentPaymentIndex}`);
    if (paymentValueInput) {
        // Definir o valor formatado
        paymentValueInput.value = parseFloat(value).toFixed(2);
        // Bloquear campo após confirmar parcelamento
        paymentValueInput.disabled = true;
        paymentValueInput.style.backgroundColor = '#f0f0f0';
        paymentValueInput.style.cursor = 'not-allowed';
        // Forçar atualização visual
        paymentValueInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Fechar modal SEM limpar os campos (clearFields = false)
    closeInstallmentModal(false);
    
    // Recalcular totais (isso também atualiza os campos)
    calculateTotals();
    
    // Atualizar limites dos campos de pagamento
    updatePaymentFieldsLimits();
}

function handlePaymentEnter(event, index) {
    if (event.key === 'Enter') {
        event.preventDefault();
        calculateTotals();
        
        if (index === 1) {
            const remaining = currentRemainingTotal;
            if (remaining > 0.009) {
                const paymentValue2 = document.getElementById('payment-value-2');
                if (paymentValue2) {
                    paymentValue2.focus();
                    paymentValue2.select();
                }
            }
        }
    }
}

// Alternar tipo de desconto (Percentual ou Real)
function toggleDiscountType() {
    const toggle = document.getElementById('discount-type-toggle');
    discountType = toggle.checked ? 'real' : 'percent';
    updateDiscountLabel();
    
    // Verificar se há desconto global aplicado (valor no campo > 0)
    const discountField = document.getElementById('sale-discount');
    const discountValue = parseFloat(discountField.value) || 0;
    
    // Só recalcular se houver desconto global aplicado E o campo não estiver zerado
    if (globalDiscount > 0 && discountValue > 0) {
        calculateTotals();
    } else {
        // Se o campo estiver zerado, garantir que globalDiscount também esteja zerado
        if (discountValue === 0) {
            globalDiscount = 0;
            calculateTotals(); // Recalcular para garantir que está correto
        }
    }
}

// Alternar tipo de juros (Percentual ou Real)
function toggleInterestType() {
    const toggle = document.getElementById('interest-type-toggle');
    if (currentSale) {
        currentSale.interestType = toggle.checked ? 'real' : 'percent';
    }
    updateInterestLabel();
}

// Atualizar label dos juros
function updateInterestLabel() {
    const label = document.getElementById('interest-label');
    const toggle = document.getElementById('interest-type-toggle');
    if (label && toggle) {
        label.textContent = toggle.checked ? 'Juros (R$)' : 'Juros (%)';
    }
}

// Atualizar informações de venda a prazo
function updateCreditPaymentInfo() {
    if (!currentSale) return;
    
    const dueDate = document.getElementById('sale-due-date').value;
    const installments = parseInt(document.getElementById('sale-installments').value) || 1;
    const interest = parseFloat(document.getElementById('sale-interest').value) || 0;
    const interestToggle = document.getElementById('interest-type-toggle');
    const interestType = interestToggle && interestToggle.checked ? 'real' : 'percent';
    
    currentSale.dueDate = dueDate || null;
    currentSale.installments = installments;
    currentSale.interest = interest;
    currentSale.interestType = interestType;
}

// Atualizar label do desconto
function updateDiscountLabel() {
    const label = document.getElementById('discount-label');
    if (discountType === 'real') {
        label.textContent = 'Desconto/Acréscimo (R$)';
    } else {
        label.textContent = 'Desconto/Acréscimo (%)';
    }
}

// Handler para mudança no campo de desconto (individual ou global)
function handleDiscountChange() {
    const discountValue = parseFloat(document.getElementById('sale-discount').value) || 0;
    
    // Se há um item selecionado, não aplicar automaticamente.
    // O usuário deve confirmar com Enter para alterar o item.
    if (saleItemIndex >= 0 && currentSale && currentSale.items[saleItemIndex]) {
        return;
    }
    
    // Para desconto global, só zerar se o campo estiver zerado
    // Não aplicar desconto global automaticamente - apenas quando pressionar Enter
    if (discountValue === 0) {
        globalDiscount = 0;
        calculateTotals();
    }
    // Se tiver valor, não aplicar ainda - esperar Enter
}

// Handler para Enter no campo de desconto
function handleDiscountEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const discountValue = parseFloat(event.target.value) || 0;
        
        // Se há um item selecionado, aplicar desconto individual
        if (saleItemIndex >= 0 && currentSale && currentSale.items[saleItemIndex]) {
            // Aplicar o desconto ao item selecionado
            calculateItemTotal();
            // Garantir que a lista seja atualizada visualmente
            updateSaleItemsList();
            // Manter o foco no campo de desconto para permitir novas alterações
            setTimeout(() => {
                document.getElementById('sale-discount').focus();
                document.getElementById('sale-discount').select();
            }, 50);
        } else {
            // Aplicar desconto global apenas quando pressionar Enter
            if (discountValue === 0) {
                globalDiscount = 0;
            } else {
                globalDiscount = discountValue;
            }
            calculateTotals();
        }
    }
}

// Handler para Enter no campo de quantidade
function handleQuantityEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        // Se há um item selecionado, atualizar a quantidade
        if (saleItemIndex >= 0 && currentSale && currentSale.items[saleItemIndex]) {
            const quantity = parseFloat(event.target.value) || 1;
            if (quantity > 0) {
                calculateItemTotal(); // Esta função já atualiza quantidade, valor e recalcula
            }
        }
        // Sempre pular para o campo Código Barras após ENTER
        const barcodeField = document.getElementById('sale-barcode');
        if (barcodeField) {
            barcodeField.focus();
            barcodeField.select();
        }
    }
}

// Zerar desconto
// Aplicar desconto global no total líquido
async function applyGlobalDiscount() {
    // Verificar permissão
    if (!hasSalesPermission('vender_aplicarDesconto')) {
        alert('⚠️ Você não tem permissão para aplicar desconto.');
        return;
    }
    
    if (!currentSale || currentSale.items.length === 0) {
        alert('Adicione pelo menos um item à venda antes de aplicar desconto!');
        return;
    }
    
    // Pegar o valor digitado no campo de desconto (será aplicado como desconto global)
    const discountValue = parseFloat(document.getElementById('sale-discount').value) || 0;
    
    if (discountValue <= 0) {
        alert('Informe um valor de desconto maior que zero!');
        return;
    }
    
    // Se há um item selecionado, não alterar o item.
    // Apenas remover a seleção antes de aplicar o desconto global.
    if (saleItemIndex >= 0 && currentSale && currentSale.items[saleItemIndex]) {
        saleItemIndex = -1;
        updateSaleItemsList();
    }
    
    // Aplicar desconto global sobre o total líquido com o valor digitado pelo usuário
    // (não o valor restaurado no campo acima)
    globalDiscount = discountValue;
    calculateTotals();
}

function resetDiscount() {
    // Verificar permissão
    if (!hasSalesPermission('vender_outrasAcoes')) {
        alert('⚠️ Você não tem permissão para zerar desconto.');
        return;
    }
    
    globalDiscount = 0;
    document.getElementById('sale-discount').value = 0;
    calculateTotals();
}

// Formatar moeda
function formatCurrency(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Abrir seletor de cliente
function openClientSelector() {
    openClientSearchPanel();
}

// Fechar seletor de cliente
function closeClientSelector() {
    closeClientSearch();
}

// Carregar clientes para venda
function loadClientsForSale() {
    const container = document.getElementById('clients-list-sale');
    if (!container) return;
    
    container.innerHTML = clients.map(client => `
        <div class="client-item" onclick="selectClientForSale(${client.id})">
            <strong>${client.name}</strong>
            ${client.phone ? `<span>${client.phone}</span>` : ''}
        </div>
    `).join('');
}

// Pesquisar clientes para venda
function searchClientsForSale() {
    const search = document.getElementById('client-search-sale').value.toLowerCase();
    const container = document.getElementById('clients-list-sale');
    if (!container) return;
    
    const filtered = clients.filter(c => 
        c.name.toLowerCase().includes(search) ||
        (c.phone && c.phone.includes(search))
    );
    
    container.innerHTML = filtered.map(client => `
        <div class="client-item" onclick="selectClientForSale(${client.id})">
            <strong>${client.name}</strong>
            ${client.phone ? `<span>${client.phone}</span>` : ''}
        </div>
    `).join('');
}

// Selecionar cliente para venda
function selectClientForSale(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (client) {
        applyClientToSale(client);
        closeClientSearch();
    }
}

// Definir cliente padrão
function setDefaultClient() {
    applyClientToSale(null);
    closeClientSearch();
}

// Verificar se forma de pagamento é a prazo
function isCreditPayment(paymentMethod) {
    if (!paymentMethod) return false;
    const methodLower = paymentMethod.toLowerCase();
    return methodLower.includes('a prazo') || 
           methodLower.includes('crédito parcelado') || 
           methodLower.includes('credito parcelado');
}

// Finalizar venda
function finalizeSale() {
    if (!currentSale || currentSale.items.length === 0) {
        alert('Adicione pelo menos um item à venda!');
        return;
    }
    
    const totalGross = currentSale.items.reduce((sum, item) => sum + item.total, 0);
    const payment1 = parseFloat(document.getElementById('payment-value-1').value) || 0;
    const payment2 = parseFloat(document.getElementById('payment-value-2').value) || 0;
    const totalPaid = payment1 + payment2;
    
    // Obter formas de pagamento selecionadas
    const paymentMethod1 = document.getElementById('payment-method-1').value;
    const paymentMethod2 = document.getElementById('payment-method-2').value;
    
    // Verificar se alguma forma de pagamento é a prazo
    const isPayment1Credit = isCreditPayment(paymentMethod1);
    const isPayment2Credit = isCreditPayment(paymentMethod2);
    const hasCreditPayment = isPayment1Credit || isPayment2Credit;
    
    // Validar cliente se for venda a prazo
    if (hasCreditPayment || totalPaid < totalGross) {
        // Verificar se o cliente é válido (não é CLIENTE PADRÃO)
        if (!currentSale.client || currentSale.clientName === 'CLIENTE PADRÃO' || !currentSale.clientName || currentSale.clientName.trim() === 'CLIENTE PADRÃO') {
            alert('⚠️ Para realizar uma venda a prazo, é necessário selecionar um cliente válido.\n\nPor favor, selecione um cliente real antes de finalizar a venda.');
            return;
        }
    }
    
    if (totalPaid < totalGross) {
        if (!confirm(`O valor pago (${formatCurrency(totalPaid)}) é menor que o total (${formatCurrency(totalGross)}). Deseja finalizar mesmo assim como venda a prazo?`)) {
            return;
        }
        currentSale.status = 'open';
    } else {
        currentSale.status = 'completed';
    }
    
    currentSale.paymentMethod1 = paymentMethod1;
    currentSale.paymentValue1 = payment1;
    currentSale.paymentMethod2 = paymentMethod2;
    currentSale.paymentValue2 = payment2;
    currentSale.totalGross = totalGross;
    currentSale.totalPaid = totalPaid;
    currentSale.totalChange = Math.max(0, totalPaid - totalGross);
    
    // Salvar informações de venda a prazo se "A Prazo" foi selecionado
    if (hasCreditPayment) {
        updateCreditPaymentInfo();
    }
    
    // Manter informações de parcelamento se existirem (já foram definidas no modal)
    // installments1, installmentValue1, installments2, installmentValue2 já estão em currentSale
    
    // Baixa automática de estoque
    currentSale.items.forEach(item => {
        if (item.productId) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                const currentStock = product.quantidadeEstoque || 0;
                const quantitySold = item.quantity || 0;
                // Subtrair quantidade vendida do estoque (permite estoque negativo)
                product.quantidadeEstoque = currentStock - quantitySold;
                product.updatedAt = new Date().toISOString();
            }
        }
    });
    
    // Salvar produtos com estoque atualizado
    saveProducts();
    
    sales.push(currentSale);
    saveSales();
    
    // Criar registro de cobrança se for venda a prazo
    if (hasCreditPayment || totalPaid < totalGross) {
        createReceivableRecord(currentSale, paymentMethod1, payment1, paymentMethod2, payment2);
    }
    
    alert('Venda finalizada com sucesso!');
    newSale();
    if (document.getElementById('inventory-exits-view')) {
        loadSalesList();
    }
    if (document.getElementById('inventory-receivables-view')) {
        loadReceivablesList();
    }
}

// Salvar vendas
function saveSales() {
    localStorage.setItem('sales', JSON.stringify(sales));
}

// Salvar contas a receber
function saveReceivables() {
    localStorage.setItem('receivables', JSON.stringify(receivables));
}

// Criar registro de cobrança para venda a prazo
function createReceivableRecord(sale, paymentMethod1, paymentValue1, paymentMethod2, paymentValue2) {
    const totalGross = sale.totalGross || 0;
    const totalPaid = sale.totalPaid || 0;
    const amountDue = totalGross - totalPaid;
    
    if (amountDue <= 0) return; // Não criar registro se já foi pago
    
    // Buscar informações do cliente
    const client = sale.client ? clients.find(c => c.id === sale.client) : null;
    const clientName = sale.clientName || (client ? (client.nome || client.name) : 'CLIENTE PADRÃO');
    const clientPhone = client ? (client.telefone || client.phone || client.whatsapp || '') : '';
    const clientPhoto = client ? (client.foto || client.photo || '') : '';
    
    // Converter data da venda para Date object
    let saleDateObj;
    if (typeof sale.date === 'string') {
        if (sale.date.includes(',')) {
            const datePart = sale.date.split(',')[0].trim();
            const [day, month, year] = datePart.split('/');
            saleDateObj = new Date(year, month - 1, day);
        } else if (sale.date.includes('T')) {
            saleDateObj = new Date(sale.date);
        } else {
            saleDateObj = new Date(sale.date);
        }
    } else {
        saleDateObj = sale.date || new Date();
    }
    
    // Usar data de vencimento da venda se definida, senão calcular
    let finalDueDate = null;
    if (sale.dueDate) {
        finalDueDate = new Date(sale.dueDate);
    } else {
        // Calcular data padrão (30 dias)
        finalDueDate = new Date(saleDateObj);
        finalDueDate.setDate(finalDueDate.getDate() + 30);
    }
    
    // Obter informações de parcelas e juros da venda
    const installments = sale.installments || 1;
    const interest = sale.interest || 0;
    const interestType = sale.interestType || 'percent';
    
    // Calcular valor com juros
    let finalAmountDue = amountDue;
    if (interest > 0) {
        if (interestType === 'percent') {
            finalAmountDue = amountDue * (1 + interest / 100);
        } else {
            finalAmountDue = amountDue + interest;
        }
    }
    
    // Verificar se é venda parcelada
    const isPayment1Installment = isCreditPayment(paymentMethod1) && sale.installments1 && sale.installments1 > 1;
    const isPayment2Installment = isCreditPayment(paymentMethod2) && sale.installments2 && sale.installments2 > 1;
    
    // Se tiver parcelas definidas na venda (campo de "A Prazo"), usar essas
    const hasInstallmentsFromField = installments > 1;
    
    if (hasInstallmentsFromField) {
        // Criar registro para cada parcela usando o campo de parcelas
        const installmentValue = finalAmountDue / installments;
        for (let i = 1; i <= installments; i++) {
            // Calcular data de vencimento de cada parcela
            const parcelDueDate = new Date(finalDueDate);
            parcelDueDate.setDate(parcelDueDate.getDate() + ((i - 1) * 30));
            
            receivables.push({
                id: Date.now() + i,
                saleId: sale.id,
                saleNumber: sale.number,
                saleDate: sale.date || sale.createdAt,
                clientId: sale.client,
                clientName: clientName,
                clientPhone: clientPhone,
                clientPhoto: clientPhoto,
                totalGross: totalGross,
                totalPaid: totalPaid,
                amountDue: installmentValue,
                dueDate: parcelDueDate.toISOString(),
                installmentNumber: i,
                totalInstallments: installments,
                paymentMethod: paymentMethod1 || paymentMethod2,
                interest: interest,
                interestType: interestType,
                status: 'pending',
                createdAt: new Date().toISOString()
            });
        }
    } else if (isPayment1Installment && sale.installmentValue1) {
        // Criar registro para cada parcela do primeiro pagamento
        const installmentValue = sale.installmentValue1 / sale.installments1;
        for (let i = 1; i <= sale.installments1; i++) {
            const dueDate = calculateDueDate(saleDateObj, i, sale.installments1);
            
            receivables.push({
                id: Date.now() + i,
                saleId: sale.id,
                saleNumber: sale.number,
                saleDate: sale.date || sale.createdAt,
                clientId: sale.client,
                clientName: clientName,
                clientPhone: clientPhone,
                clientPhoto: clientPhoto,
                totalGross: totalGross,
                totalPaid: totalPaid,
                amountDue: installmentValue,
                dueDate: dueDate.toISOString(),
                installmentNumber: i,
                totalInstallments: sale.installments1,
                paymentMethod: paymentMethod1,
                interest: interest,
                interestType: interestType,
                status: 'pending',
                createdAt: new Date().toISOString()
            });
        }
    } else if (isPayment2Installment && sale.installmentValue2) {
        // Criar registro para cada parcela do segundo pagamento
        const installmentValue = sale.installmentValue2 / sale.installments2;
        for (let i = 1; i <= sale.installments2; i++) {
            const dueDate = calculateDueDate(saleDateObj, i, sale.installments2);
            
            receivables.push({
                id: Date.now() + i,
                saleId: sale.id,
                saleNumber: sale.number,
                saleDate: sale.date || sale.createdAt,
                clientId: sale.client,
                clientName: clientName,
                clientPhone: clientPhone,
                clientPhoto: clientPhoto,
                totalGross: totalGross,
                totalPaid: totalPaid,
                amountDue: installmentValue,
                dueDate: dueDate.toISOString(),
                installmentNumber: i,
                totalInstallments: sale.installments2,
                paymentMethod: paymentMethod2,
                interest: interest,
                interestType: interestType,
                status: 'pending',
                createdAt: new Date().toISOString()
            });
        }
    } else {
        // Venda a prazo sem parcelamento - criar um único registro
        receivables.push({
            id: Date.now(),
            saleId: sale.id,
            saleNumber: sale.number,
            saleDate: sale.date || sale.createdAt,
            clientId: sale.client,
            clientName: clientName,
            clientPhone: clientPhone,
            clientPhoto: clientPhoto,
            totalGross: totalGross,
            totalPaid: totalPaid,
            amountDue: finalAmountDue,
            dueDate: finalDueDate.toISOString(),
            installmentNumber: null,
            totalInstallments: installments > 1 ? installments : null,
            paymentMethod: paymentMethod1 || paymentMethod2,
            interest: interest,
            interestType: interestType,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
    }
    
    saveReceivables();
}

// Carregar lista de vendas
function loadSalesList() {
    const tbody = document.getElementById('sales-list-body');
    if (!tbody) return;
    
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #666;">Nenhuma venda encontrada</td></tr>';
        return;
    }
    
    tbody.innerHTML = sales.map(sale => {
        const statusClass = {
            'completed': 'status-completed',
            'open': 'status-open',
            'partial': 'status-partial',
            'cancelled': 'status-cancelled'
        }[sale.status] || 'status-open';
        
        const statusText = {
            'completed': 'Concluída',
            'open': 'Em Aberto',
            'partial': 'Parcialmente Paga',
            'cancelled': 'Cancelada'
        }[sale.status] || 'Em Aberto';
        
        return `
            <tr>
                <td>${sale.id}</td>
                <td>${sale.date}</td>
                <td>${sale.number}</td>
                <td>${sale.clientName || 'CLIENTE PADRÃO'}</td>
                <td>${formatCurrency(sale.totalGross || 0)}</td>
                <td>${sale.seller || 'N/A'}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-small btn-primary" onclick="reprintReceipt(${sale.id})">🖨️ Reimprimir</button>
                    <button class="btn btn-small btn-danger" onclick="deleteSale(${sale.id})">🗑️ Excluir</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Pesquisar vendas
function searchSales() {
    const search = document.getElementById('sales-search').value.toLowerCase();
    const rows = document.querySelectorAll('#sales-list-body tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

// Abrir filtros de vendas
function openSalesFilter() {
    const panel = document.getElementById('sales-filter-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// Aplicar filtros de vendas
function applySalesFilter() {
    const dateStart = document.getElementById('filter-date-start').value;
    const dateEnd = document.getElementById('filter-date-end').value;
    const saleNumber = document.getElementById('filter-sale-number').value;
    const client = document.getElementById('filter-client').value.toLowerCase();
    const saleType = document.getElementById('filter-sale-type').value;
    
    let filtered = sales;
    
    if (dateStart) {
        filtered = filtered.filter(s => new Date(s.createdAt) >= new Date(dateStart));
    }
    if (dateEnd) {
        filtered = filtered.filter(s => new Date(s.createdAt) <= new Date(dateEnd + 'T23:59:59'));
    }
    if (saleNumber) {
        filtered = filtered.filter(s => s.number.includes(saleNumber));
    }
    if (client) {
        filtered = filtered.filter(s => (s.clientName || '').toLowerCase().includes(client));
    }
    if (saleType) {
        filtered = filtered.filter(s => s.status === saleType);
    }
    
    // Atualizar lista com resultados filtrados
    const tbody = document.getElementById('sales-list-body');
    if (tbody) {
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #666;">Nenhuma venda encontrada</td></tr>';
        } else {
            tbody.innerHTML = filtered.map(sale => {
                const statusClass = {
                    'completed': 'status-completed',
                    'open': 'status-open',
                    'partial': 'status-partial',
                    'cancelled': 'status-cancelled'
                }[sale.status] || 'status-open';
                
                const statusText = {
                    'completed': 'Concluída',
                    'open': 'Em Aberto',
                    'partial': 'Parcialmente Paga',
                    'cancelled': 'Cancelada'
                }[sale.status] || 'Em Aberto';
                
                return `
                    <tr>
                        <td>${sale.id}</td>
                        <td>${sale.date}</td>
                        <td>${sale.number}</td>
                        <td>${sale.clientName || 'CLIENTE PADRÃO'}</td>
                        <td>${formatCurrency(sale.totalGross || 0)}</td>
                        <td>${sale.seller || 'N/A'}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>
                            <button class="btn btn-small btn-primary" onclick="reprintReceipt(${sale.id})">🖨️ Reimprimir</button>
                            <button class="btn btn-small btn-danger" onclick="deleteSale(${sale.id})">🗑️ Excluir</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }
}

// Limpar filtros
function clearSalesFilter() {
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    document.getElementById('filter-sale-number').value = '';
    document.getElementById('filter-client').value = '';
    document.getElementById('filter-sale-type').value = '';
    loadSalesList();
}

// Reimprimir cupom
function reprintReceipt(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (sale) {
        alert('Funcionalidade de impressão será implementada em breve.');
        // Aqui você pode implementar a lógica de impressão
    }
}

// Excluir venda
function deleteSale(saleId) {
    if (confirm('Tem certeza que deseja excluir esta venda?')) {
        sales = sales.filter(s => s.id !== saleId);
        saveSales();
        loadSalesList();
    }
}

// Pesquisar produtos (inline)
function openSaleProductSearch() {
    // Verificar permissão
    if (!hasSalesPermission('vender_outrasAcoes')) {
        alert('⚠️ Você não tem permissão para pesquisar produtos.');
        return;
    }
    
    openProductSearchPanel();
}

// Abrir pesquisa ao clicar no campo de descrição
function openProductSearchFromDescription() {
    openProductSearchPanel();
}

function openProductSearchPanel() {
    const panel = document.getElementById('product-search-inline-panel');
    const saleItemsContainer = document.getElementById('sale-items-container');
    const input = document.getElementById('product-search-inline-input');
    if (!panel || !saleItemsContainer || !input) return;
    
    isProductSearchOpen = true;
    isClientSearchOpen = false;
    updateSalePanelVisibility();
    input.value = '';
    performProductSearch('');
    setTimeout(() => input.focus(), 50);
}

function closeProductSearch() {
    isProductSearchOpen = false;
    selectedProductIndex = -1;
    updateSalePanelVisibility();
}

function handleProductSearchInput() {
    const input = document.getElementById('product-search-inline-input');
    if (!input) return;
    performProductSearch(input.value);
}

function handleProductSearchKeydown(event) {
    if (!isProductSearchOpen) return;
    const items = document.querySelectorAll('#product-search-inline-results .product-search-item-simple');
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (items.length === 0) return;
        selectedProductIndex = selectedProductIndex < items.length - 1 ? selectedProductIndex + 1 : 0;
        updateProductSelection();
        items[selectedProductIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (items.length === 0) return;
        selectedProductIndex = selectedProductIndex > 0 ? selectedProductIndex - 1 : items.length - 1;
        updateProductSelection();
        items[selectedProductIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (event.key === 'Enter') {
        event.preventDefault();
        confirmProductSelection();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        closeProductSearch();
    }
}

function performProductSearch(query = '') {
    const normalized = normalizeText(query);
    const rawQuery = query.trim();
    const searchAsNumber = parseFloat(rawQuery.replace(',', '.'));
    const isNumericSearch = !isNaN(searchAsNumber);
    
    if (!normalized && !isNumericSearch) {
        productSearchResults = [...products];
    } else {
        productSearchResults = products.filter(p => {
            const nomeProduto = normalizeText(p.nome || p.name || '');
            const codigoBarras = normalizeText(p.codigoBarras || p.barcode || p.sku || '');
            const descricao = normalizeText(p.descricao || p.description || '');
            const precoVenda = p.precoVenda || p.salePrice || 0;
            
            const matchesName = nomeProduto.includes(normalized) || descricao.includes(normalized);
            const matchesBarcode = codigoBarras.includes(normalized);
            const matchesPrice = isNumericSearch && (
                precoVenda.toString().includes(searchAsNumber.toString()) ||
                Math.abs(precoVenda - searchAsNumber) < 0.01 ||
                precoVenda.toFixed(2).replace('.', ',').includes(rawQuery)
            );
            
            return matchesName || matchesBarcode || matchesPrice;
        });
    }
    
    selectedProductIndex = productSearchResults.length > 0 ? 0 : -1;
    renderProductSearchResults();
}

function renderProductSearchResults() {
    const container = document.getElementById('product-search-inline-results');
    if (!container) return;
    
    if (!productSearchResults || productSearchResults.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhum produto encontrado</p>';
        return;
    }
    
    container.innerHTML = productSearchResults.map((product, index) => {
        const nomeProduto = product.nome || product.name || 'Sem nome';
        const codigoBarras = product.codigoBarras || product.barcode || 'N/A';
        const precoVenda = product.precoVenda || product.salePrice || 0;
        
        return `
        <div class="product-search-item-simple ${index === selectedProductIndex ? 'product-search-item-selected' : ''}"
             onclick="selectProductFromSearch(${index})"
             ondblclick="confirmProductSelection()">
            <div class="product-search-info-simple">
                <div class="product-search-row">
                    <strong>${nomeProduto}</strong>
                    <span class="product-price">R$ ${precoVenda.toFixed(2).replace('.', ',')}</span>
                </div>
                <div class="product-search-row">
                    <small>Código Barras: ${codigoBarras}</small>
                </div>
            </div>
        </div>
    `;
    }).join('');
    
    updateProductSelection();
}

function updateProductSelection() {
    const items = document.querySelectorAll('#product-search-inline-results .product-search-item-simple');
    items.forEach((item, index) => {
        if (index === selectedProductIndex) {
            item.classList.add('product-search-item-selected');
        } else {
            item.classList.remove('product-search-item-selected');
        }
    });
}

function selectProductFromSearch(index) {
    selectedProductIndex = index;
    updateProductSelection();
}

function confirmProductSelection() {
    if (!productSearchResults || productSearchResults.length === 0) return;
    if (selectedProductIndex < 0 || selectedProductIndex >= productSearchResults.length) {
        selectedProductIndex = 0;
    }
    const product = productSearchResults[selectedProductIndex];
    // Ler a quantidade ANTES de preencher os campos (para não perder o valor)
    const currentQuantity = parseFloat(document.getElementById('sale-quantity').value) || 1;
    fillSaleFieldsForProduct(product);
    // Restaurar a quantidade que estava no campo antes de preencher
    document.getElementById('sale-quantity').value = currentQuantity;
    addProductToSale(product);
    closeProductSearch();
}

function handleClientSearchInput() {
    const input = document.getElementById('client-search-inline-input');
    if (!input) return;
    performClientSearch(input.value);
}

function handleClientSearchKeydown(event) {
    if (!isClientSearchOpen) return;
    const items = document.querySelectorAll('#client-search-inline-results .product-search-item-simple');
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (items.length === 0) return;
        selectedClientIndex = selectedClientIndex < items.length - 1 ? selectedClientIndex + 1 : 0;
        updateClientSelection();
        items[selectedClientIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (items.length === 0) return;
        selectedClientIndex = selectedClientIndex > 0 ? selectedClientIndex - 1 : items.length - 1;
        updateClientSelection();
        items[selectedClientIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (event.key === 'Enter') {
        event.preventDefault();
        confirmClientSelection();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        closeClientSearch();
    }
}

function performClientSearch(query = '') {
    const normalized = normalizeText(query);
    const digits = query.replace(/\D/g, '');
    if (!normalized && !digits) {
        clientSearchResults = [...clients];
    } else {
        clientSearchResults = clients.filter(client => {
            const name = normalizeText(client.name || '');
            const phone = (client.phone || '').replace(/\D/g, '');
            return name.includes(normalized) || (digits && phone.includes(digits));
        });
    }
    selectedClientIndex = clientSearchResults.length > 0 ? 0 : -1;
    renderClientSearchResults();
}

function renderClientSearchResults() {
    const container = document.getElementById('client-search-inline-results');
    if (!container) return;
    
    if (!clientSearchResults || clientSearchResults.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhum cliente encontrado</p>';
        return;
    }
    
    container.innerHTML = clientSearchResults.map((client, index) => `
        <div class="product-search-item-simple ${index === selectedClientIndex ? 'product-search-item-selected' : ''}"
             onclick="selectClientFromSearch(${index})"
             ondblclick="confirmClientSelection()">
            <div class="product-search-info-simple">
                <div class="product-search-row">
                    <strong>${client.name}</strong>
                </div>
                <div class="product-search-row">
                    <small>${client.phone || 'Sem telefone'}</small>
                </div>
            </div>
        </div>
    `).join('');
    updateClientSelection();
}

function updateClientSelection() {
    const items = document.querySelectorAll('#client-search-inline-results .product-search-item-simple');
    items.forEach((item, index) => {
        if (index === selectedClientIndex) {
            item.classList.add('product-search-item-selected');
        } else {
            item.classList.remove('product-search-item-selected');
        }
    });
}

function selectClientFromSearch(index) {
    selectedClientIndex = index;
    updateClientSelection();
}

function confirmClientSelection() {
    if (!clientSearchResults || clientSearchResults.length === 0) return;
    if (selectedClientIndex < 0 || selectedClientIndex >= clientSearchResults.length) {
        selectedClientIndex = 0;
    }
    const client = clientSearchResults[selectedClientIndex];
    applyClientToSale(client);
    closeClientSearch();
}

function applyClientToSale(client) {
    if (!currentSale) newSale();
    if (client) {
        currentSale.client = client.id;
        currentSale.clientName = client.name;
        const clientField = document.getElementById('sale-client');
        if (clientField) clientField.value = client.name;
    } else {
        currentSale.client = null;
        currentSale.clientName = 'CLIENTE PADRÃO';
        const clientField = document.getElementById('sale-client');
        if (clientField) clientField.value = 'CLIENTE PADRÃO';
    }
}

function openClientSearchPanel() {
    const panel = document.getElementById('client-search-inline-panel');
    const input = document.getElementById('client-search-inline-input');
    if (!panel || !input) return;
    
    isClientSearchOpen = true;
    isProductSearchOpen = false;
    updateSalePanelVisibility();
    input.value = '';
    performClientSearch('');
    setTimeout(() => input.focus(), 50);
}

// Handler para Enter no Valor Unitário (adicionar DIVERSOS)
function handleUnitValueEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const unitValue = parseFloat(event.target.value) || 0;
        if (unitValue > 0) {
            // Adicionar item DIVERSOS com o valor informado
            addProductToSale(null); // null = DIVERSOS
        }
    }
}

// Localizar venda
function searchSale() {
    // Verificar permissão
    if (!hasSalesPermission('vender_localizarVenda')) {
        alert('⚠️ Você não tem permissão para localizar vendas.');
        return;
    }
    
    document.getElementById('locate-sale-modal').style.display = 'block';
}

// Fechar localizar venda
function closeLocateSale() {
    document.getElementById('locate-sale-modal').style.display = 'none';
}

// Realizar busca de venda
function performLocateSale() {
    const input = document.getElementById('locate-sale-input').value;
    const date = document.getElementById('locate-sale-date').value;
    const results = document.getElementById('locate-sale-results');
    
    let filtered = sales;
    
    if (input) {
        filtered = filtered.filter(s => 
            s.number.includes(input) || 
            String(s.id).includes(input)
        );
    }
    
    if (date) {
        filtered = filtered.filter(s => {
            const saleDate = new Date(s.createdAt).toISOString().split('T')[0];
            return saleDate === date;
        });
    }
    
    if (filtered.length === 0) {
        results.innerHTML = '<p style="color: #666;">Nenhuma venda encontrada</p>';
        return;
    }
    
    results.innerHTML = filtered.map(sale => `
        <div class="located-sale-item">
            <strong>Venda #${sale.number}</strong>
            <span>${sale.date}</span>
            <span>${sale.clientName || 'CLIENTE PADRÃO'}</span>
            <span>${formatCurrency(sale.totalGross || 0)}</span>
            <button class="btn btn-small btn-primary" onclick="viewSaleDetails(${sale.id})">Ver Detalhes</button>
        </div>
    `).join('');
}

// Ver detalhes da venda
function viewSaleDetails(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (sale) {
        alert(`Venda #${sale.number}\nCliente: ${sale.clientName}\nTotal: ${formatCurrency(sale.totalGross)}\nStatus: ${sale.status}`);
    }
}

// Editar produto
function editProduct() {
    if (saleItemIndex >= 0 && currentSale && currentSale.items[saleItemIndex]) {
        const item = currentSale.items[saleItemIndex];
        document.getElementById('sale-quantity').value = item.quantity;
        document.getElementById('sale-description').value = item.name;
        document.getElementById('sale-unit-value').value = item.unitValue;
        document.getElementById('sale-discount').value = item.discount;
        alert('Edite os campos acima e pressione Enter na descrição para atualizar o item.');
    } else {
        alert('Selecione um item da lista para editar.');
    }
}

// Remover produto
async function removeProduct() {
    // Verificar permissão
    if (!hasSalesPermission('vender_cancelarItemVenda')) {
        const authorized = await requestAuthorizationPassword('vender_cancelarItemVenda', 'Excluir Produto');
        if (!authorized) {
            return;
        }
    }
    
    if (saleItemIndex >= 0 && currentSale && currentSale.items[saleItemIndex]) {
        if (confirm('Deseja remover este item da venda?')) {
            currentSale.items.splice(saleItemIndex, 1);
            saleItemIndex = -1;
            updateSaleItemsList();
            calculateTotals();
        }
    } else {
        alert('Selecione um item da lista para remover.');
    }
}

// Cancelar venda
async function cancelSale() {
    // Verificar permissão
    if (!hasSalesPermission('vender_cancelarItemVenda')) {
        const authorized = await requestAuthorizationPassword('vender_cancelarItemVenda', 'Cancelar / Excluir Venda');
        if (!authorized) {
            return;
        }
    }
    
    if (confirm('Tem certeza que deseja cancelar esta venda? Todos os itens serão perdidos.')) {
        newSale();
    }
}

// Sair da tela de vendas
function exitSales() {
    if (currentSale && currentSale.items.length > 0) {
        if (!confirm('Há itens na venda atual. Deseja realmente sair?')) {
            return;
        }
    }
    // Restaurar tamanho normal da janela ao sair
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.log(err));
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    showSection('home');
}

// Imprimir cupom 80mm
function printReceipt80mm() {
    if (!currentSale || currentSale.items.length === 0) {
        alert('Não há itens na venda para imprimir!');
        return;
    }
    printReceipt(80);
}

function printReceipt58mm() {
    if (!currentSale || currentSale.items.length === 0) {
        alert('Não há itens na venda para imprimir!');
        return;
    }
    printReceipt(58);
}

// Função genérica para imprimir cupom
function printReceipt(width) {
    if (!currentSale || currentSale.items.length === 0) {
        alert('Não há itens na venda para imprimir!');
        return;
    }
    
    const totalGross = currentSale.items.reduce((sum, item) => sum + item.total, 0);
    const companyName = companyData ? (companyData.name || 'Empresa') : 'Empresa';
    const companyAddress = companyData ? (companyData.address || '') : '';
    const companyPhone = companyData ? (companyData.phone || '') : '';
    
    // Construir HTML do cupom
    let receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Cupom Fiscal - Venda ${currentSale.number}</title>
            <style>
                @media print {
                    @page { margin: 0; size: ${width}mm auto; }
                    body { margin: 0; padding: 10px; font-size: 12px; }
                }
                body {
                    font-family: 'Courier New', monospace;
                    width: ${width}mm;
                    margin: 0 auto;
                    padding: 10px;
                    font-size: 12px;
                }
                .receipt-header {
                    text-align: center;
                    border-bottom: 2px dashed #000;
                    padding-bottom: 10px;
                    margin-bottom: 10px;
                }
                .receipt-title {
                    font-weight: bold;
                    font-size: 16px;
                    margin-bottom: 5px;
                }
                .receipt-info {
                    margin: 5px 0;
                    font-size: 11px;
                }
                .receipt-items {
                    margin: 10px 0;
                }
                .receipt-item {
                    margin: 5px 0;
                    padding: 5px 0;
                    border-bottom: 1px dotted #ccc;
                }
                .receipt-totals {
                    margin-top: 15px;
                    border-top: 2px dashed #000;
                    padding-top: 10px;
                }
                .receipt-total-line {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                    font-weight: bold;
                }
                .receipt-payment {
                    margin: 10px 0;
                    padding: 10px 0;
                    border-top: 1px dashed #000;
                    border-bottom: 1px dashed #000;
                }
                .receipt-installment {
                    background: #f0f0f0;
                    padding: 8px;
                    margin: 8px 0;
                    border-left: 3px solid #333;
                }
                .receipt-installment-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .receipt-installment-info {
                    font-size: 11px;
                    margin: 3px 0;
                }
                .receipt-footer {
                    text-align: center;
                    margin-top: 20px;
                    padding-top: 10px;
                    border-top: 2px dashed #000;
                    font-size: 10px;
                }
            </style>
        </head>
        <body>
            <div class="receipt-header">
                <div class="receipt-title">${companyName}</div>
                ${companyAddress ? `<div class="receipt-info">${companyAddress}</div>` : ''}
                ${companyPhone ? `<div class="receipt-info">Tel: ${companyPhone}</div>` : ''}
                <div class="receipt-info">CUPOM FISCAL</div>
            </div>
            
            <div class="receipt-info">
                <strong>Venda:</strong> ${currentSale.number}<br>
                <strong>Data:</strong> ${currentSale.date}<br>
                <strong>Cliente:</strong> ${currentSale.clientName || 'CLIENTE PADRÃO'}<br>
                <strong>Vendedor:</strong> ${currentSale.seller || 'N/A'}
            </div>
            
            <div class="receipt-items">
                <strong>ITENS:</strong>
                ${currentSale.items.map(item => `
                    <div class="receipt-item">
                        ${item.name || 'DIVERSOS'}<br>
                        Qtd: ${item.quantity} x ${formatCurrency(item.unitValue)} = ${formatCurrency(item.total)}
                    </div>
                `).join('')}
            </div>
            
            <div class="receipt-totals">
                <div class="receipt-total-line">
                    <span>VALOR TOTAL DA VENDA:</span>
                    <span>${formatCurrency(totalGross)}</span>
                </div>
            </div>
            
            <div class="receipt-payment">
                <strong>FORMA DE PAGAMENTO:</strong><br>
    `;
    
    // Adicionar informações de pagamento 1
    if (currentSale.paymentMethod1 && currentSale.paymentValue1 > 0) {
        receiptHTML += `
            <div style="margin: 5px 0;">
                ${currentSale.paymentMethod1}: ${formatCurrency(currentSale.paymentValue1)}
        `;
        
        // Se houver parcelamento no pagamento 1
        if (currentSale.installments1 && currentSale.installments1 > 1 && currentSale.installmentValue1) {
            const installmentValue = currentSale.installmentValue1 / currentSale.installments1;
            receiptHTML += `
                <div class="receipt-installment">
                    <div class="receipt-installment-title">PARCELAMENTO (${currentSale.paymentMethod1}):</div>
                    <div class="receipt-installment-info">Valor Total Parcelado: ${formatCurrency(currentSale.installmentValue1)}</div>
                    <div class="receipt-installment-info">Número de Parcelas: ${currentSale.installments1}x</div>
                    <div class="receipt-installment-info"><strong>Valor de cada Parcela: ${formatCurrency(installmentValue)}</strong></div>
                </div>
            `;
        }
        
        receiptHTML += `</div>`;
    }
    
    // Adicionar informações de pagamento 2
    if (currentSale.paymentMethod2 && currentSale.paymentValue2 > 0) {
        receiptHTML += `
            <div style="margin: 5px 0;">
                ${currentSale.paymentMethod2}: ${formatCurrency(currentSale.paymentValue2)}
        `;
        
        // Se houver parcelamento no pagamento 2
        if (currentSale.installments2 && currentSale.installments2 > 1 && currentSale.installmentValue2) {
            const installmentValue = currentSale.installmentValue2 / currentSale.installments2;
            receiptHTML += `
                <div class="receipt-installment">
                    <div class="receipt-installment-title">PARCELAMENTO (${currentSale.paymentMethod2}):</div>
                    <div class="receipt-installment-info">Valor Total Parcelado: ${formatCurrency(currentSale.installmentValue2)}</div>
                    <div class="receipt-installment-info">Número de Parcelas: ${currentSale.installments2}x</div>
                    <div class="receipt-installment-info"><strong>Valor de cada Parcela: ${formatCurrency(installmentValue)}</strong></div>
                </div>
            `;
        }
        
        receiptHTML += `</div>`;
    }
    
    receiptHTML += `
            </div>
            
            <div class="receipt-footer">
                <div>Obrigado pela preferência!</div>
                <div style="margin-top: 5px;">${new Date().toLocaleString('pt-BR')}</div>
            </div>
        </body>
        </html>
    `;
    
    // Abrir janela de impressão
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    
    // Aguardar carregamento e imprimir
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };
}

// Toggle dropdown de impressão
function togglePrintDropdown() {
    const dropdown = document.getElementById('print-dropdown-menu');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

// Fechar dropdown ao clicar fora
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('print-dropdown-menu');
    const wrapper = event.target.closest('.btn-dropdown-wrapper');
    if (dropdown && !wrapper) {
        dropdown.style.display = 'none';
    }
});

// Função removida - agora usa printReceipt(58)

// ==================== FUNÇÕES DE CONTAS A RECEBER ====================

// Calcular data de vencimento baseado em parcelas
function calculateDueDate(saleDate, installmentNumber, totalInstallments) {
    if (!saleDate) return null;
    
    // Converter data da venda para Date object
    let saleDateObj;
    if (saleDate instanceof Date) {
        saleDateObj = saleDate;
    } else if (typeof saleDate === 'string') {
        // Formato: "30/11/2025, 18:42:20" ou ISO
        if (saleDate.includes(',')) {
            const datePart = saleDate.split(',')[0].trim();
            const [day, month, year] = datePart.split('/');
            saleDateObj = new Date(year, month - 1, day);
        } else if (saleDate.includes('T')) {
            saleDateObj = new Date(saleDate);
        } else {
            saleDateObj = new Date(saleDate);
        }
    } else {
        saleDateObj = saleDate;
    }
    
    // Se for venda parcelada, calcular vencimento baseado na parcela
    if (totalInstallments && totalInstallments > 1 && installmentNumber) {
        // Cada parcela vence 30 dias após a anterior (ou após a data da venda para a primeira)
        const daysToAdd = (installmentNumber - 1) * 30;
        const dueDate = new Date(saleDateObj);
        dueDate.setDate(dueDate.getDate() + daysToAdd);
        return dueDate;
    } else {
        // Venda a prazo sem parcelamento: vence 30 dias após a venda
        const dueDate = new Date(saleDateObj);
        dueDate.setDate(dueDate.getDate() + 30);
        return dueDate;
    }
}

// Obter status da conta (A Vencer, Vencido, Pago)
function getReceivableStatus(sale, dueDate, amountDue) {
    // Se amountDue for 0, considerar como pago
    if (amountDue !== undefined && amountDue !== null && amountDue === 0) {
        return 'pago';
    }
    
    if (sale.status === 'completed' || (sale.totalPaid >= sale.totalGross)) {
        return 'pago';
    }
    
    if (!dueDate) return 'a-vencer';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    if (due < today) {
        return 'vencido';
    } else {
        return 'a-vencer';
    }
}

// Carregar lista de contas a receber
function loadReceivablesList() {
    const container = document.getElementById('receivables-cards-container');
    if (!container) return;
    
    // Carregar receivables do localStorage
    receivables = JSON.parse(localStorage.getItem('receivables')) || [];
    
    // Carregar todos os receivables (incluindo pagos)
    let receivablesList = receivables.map(rec => {
        const recCopy = { ...rec };
        if (rec.dueDate) {
            recCopy.dueDate = new Date(rec.dueDate);
        }
        // Garantir que amountDue existe
        if (recCopy.amountDue === undefined || recCopy.amountDue === null) {
            recCopy.amountDue = 0;
        }
        return recCopy;
    });
    
    // Aplicar filtros
    receivablesList = applyReceivablesFilters(receivablesList);
    
    // Ocultar cards com valor devedor = 0, exceto quando filtro "pago" estiver ativo
    const statusFilter = document.getElementById('filter-receivables-status')?.value || '';
    if (statusFilter !== 'pago') {
        receivablesList = receivablesList.filter(rec => {
            const amountDue = rec.amountDue || 0;
            return amountDue > 0;
        });
    }
    
    // Ordenar por data de vencimento (vencidos primeiro, depois por data)
    receivablesList.sort((a, b) => {
        const statusA = getReceivableStatus({ totalPaid: a.totalPaid, totalGross: a.totalGross, status: 'open' }, a.dueDate, a.amountDue);
        const statusB = getReceivableStatus({ totalPaid: b.totalPaid, totalGross: b.totalGross, status: 'open' }, b.dueDate, b.amountDue);
        
        if (statusA === 'vencido' && statusB !== 'vencido') return -1;
        if (statusA !== 'vencido' && statusB === 'vencido') return 1;
        
        if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        return 0;
    });
    
    // Renderizar cards
    renderReceivablesCards(receivablesList);
}

// Aplicar filtros às contas a receber
function applyReceivablesFilters(receivablesList) {
    const clientNameFilter = document.getElementById('filter-receivables-client-name')?.value.toLowerCase() || '';
    const phoneFilter = document.getElementById('filter-receivables-phone')?.value || '';
    const saleNumberFilter = document.getElementById('filter-receivables-sale-number')?.value || '';
    const statusFilter = document.getElementById('filter-receivables-status')?.value || '';
    const dateStartFilter = document.getElementById('filter-receivables-date-start')?.value || '';
    const dateEndFilter = document.getElementById('filter-receivables-date-end')?.value || '';
    
    return receivablesList.filter(receivable => {
        // Filtro por nome do cliente
        if (clientNameFilter && !receivable.clientName.toLowerCase().includes(clientNameFilter)) {
            return false;
        }
        
        // Filtro por telefone
        if (phoneFilter && !receivable.clientPhone.includes(phoneFilter)) {
            return false;
        }
        
        // Filtro por número da venda
        if (saleNumberFilter && !receivable.saleNumber.toString().includes(saleNumberFilter)) {
            return false;
        }
        
        // Filtro por status
        if (statusFilter) {
            const amountDue = receivable.amountDue || 0;
            const status = getReceivableStatus({ totalPaid: receivable.totalPaid, totalGross: receivable.totalGross, status: 'open' }, receivable.dueDate, amountDue);
            if (status !== statusFilter) {
                return false;
            }
        }
        
        // Filtro por período
        if (dateStartFilter || dateEndFilter) {
            const saleDate = new Date(receivable.saleDate);
            if (dateStartFilter) {
                const startDate = new Date(dateStartFilter);
                if (saleDate < startDate) return false;
            }
            if (dateEndFilter) {
                const endDate = new Date(dateEndFilter);
                endDate.setHours(23, 59, 59);
                if (saleDate > endDate) return false;
            }
        }
        
        return true;
    });
}

// Renderizar cards de contas a receber
function renderReceivablesCards(receivablesList) {
    const container = document.getElementById('receivables-cards-container');
    if (!container) return;
    
    if (receivablesList.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Nenhuma conta a receber encontrada com os filtros aplicados</div>';
        return;
    }
    
    container.innerHTML = receivablesList.map(receivable => {
        const amountDue = receivable.amountDue || 0;
        const status = getReceivableStatus({ totalPaid: receivable.totalPaid, totalGross: receivable.totalGross, status: 'open' }, receivable.dueDate, amountDue);
        const statusClass = {
            'a-vencer': 'receivable-status-avencer',
            'vencido': 'receivable-status-vencido',
            'pago': 'receivable-status-pago'
        }[status] || 'receivable-status-avencer';
        
        const statusText = {
            'a-vencer': 'A Vencer',
            'vencido': 'Vencido',
            'pago': 'Pago'
        }[status] || 'A Vencer';
        
        let dueDateFormatted = 'Não definida';
        if (receivable.dueDate) {
            if (receivable.dueDate instanceof Date) {
                dueDateFormatted = receivable.dueDate.toLocaleDateString('pt-BR');
            } else {
                dueDateFormatted = formatDate(receivable.dueDate.toISOString());
            }
        }
        const saleDateFormatted = formatDate(receivable.saleDate);
        
        const installmentInfo = receivable.installmentNumber && receivable.totalInstallments 
            ? `Parcela ${receivable.installmentNumber}/${receivable.totalInstallments}` 
            : (receivable.totalInstallments && receivable.totalInstallments > 1 
                ? `${receivable.totalInstallments} parcelas` 
                : '');
        
        const interestInfo = receivable.interest && receivable.interest > 0
            ? `${receivable.interestType === 'percent' ? receivable.interest + '%' : formatCurrency(receivable.interest)}`
            : '';
        
        return `
            <div class="receivable-card ${statusClass}" onclick="openReceivableDetails(${receivable.id})" style="cursor: pointer;">
                <div class="receivable-card-header">
                    <div class="receivable-client-photo">
                        ${receivable.clientPhoto 
                            ? `<img src="${receivable.clientPhoto}" alt="${receivable.clientName}">` 
                            : `<div class="receivable-client-icon">👤</div>`}
                    </div>
                    <div class="receivable-client-info">
                        <h3>${receivable.clientName}</h3>
                        ${receivable.clientPhone ? `<p class="receivable-phone">📞 ${receivable.clientPhone}</p>` : ''}
                    </div>
                    <div class="receivable-status-badge ${statusClass}">
                        ${statusText}
                    </div>
                </div>
                <div class="receivable-card-body">
                    <div class="receivable-info-row">
                        <span class="receivable-label">Nr. Venda:</span>
                        <span class="receivable-value">${receivable.saleNumber}</span>
                    </div>
                    <div class="receivable-info-row">
                        <span class="receivable-label">Data da Compra:</span>
                        <span class="receivable-value">${saleDateFormatted}</span>
                    </div>
                    <div class="receivable-info-row">
                        <span class="receivable-label">Data de Vencimento:</span>
                        <span class="receivable-value receivable-due-date ${statusClass}">${dueDateFormatted}</span>
                    </div>
                    ${installmentInfo ? `
                    <div class="receivable-info-row">
                        <span class="receivable-label">Parcelas:</span>
                        <span class="receivable-value">${installmentInfo}</span>
                    </div>
                    ` : ''}
                    ${interestInfo ? `
                    <div class="receivable-info-row">
                        <span class="receivable-label">Juros:</span>
                        <span class="receivable-value">${interestInfo}</span>
                    </div>
                    ` : ''}
                    <div class="receivable-info-row">
                        <span class="receivable-label">Valor Devido:</span>
                        <span class="receivable-value receivable-amount">${formatCurrency(receivable.amountDue)}</span>
                    </div>
                    ${receivable.paymentMethod ? `
                    <div class="receivable-info-row">
                        <span class="receivable-label">Forma de Pagamento:</span>
                        <span class="receivable-value">${receivable.paymentMethod}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="receivable-card-actions">
                    ${(receivable.amountDue || 0) === 0 ? `
                    <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteReceivable(${receivable.id})" title="Excluir Conta">
                        🗑️ Excluir
                    </button>
                    ` : ''}
                    ${hasReceivablesPermission('alterar') && (receivable.amountDue || 0) > 0 ? `
                    <button class="btn btn-small btn-success" onclick="event.stopPropagation(); openReceivablePaymentModal(${receivable.id})" title="Registrar Pagamento">
                        💰 Registrar Pagamento
                    </button>
                    ` : ''}
                    <button class="btn btn-small btn-info" onclick="event.stopPropagation(); generateWhatsAppMessage(${receivable.id})" title="Enviar Lembrete via WhatsApp">
                        📱 WhatsApp
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Pesquisar contas a receber
function searchReceivables() {
    loadReceivablesList();
}

// Toggle painel de filtros
function toggleReceivablesFilter() {
    const panel = document.getElementById('receivables-filter-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
}

// Aplicar filtros
function applyReceivablesFilter() {
    loadReceivablesList();
    toggleReceivablesFilter();
}

// Limpar filtros
function clearReceivablesFilter() {
    document.getElementById('filter-receivables-client-name').value = '';
    document.getElementById('filter-receivables-phone').value = '';
    document.getElementById('filter-receivables-sale-number').value = '';
    document.getElementById('filter-receivables-status').value = '';
    document.getElementById('filter-receivables-date-start').value = '';
    document.getElementById('filter-receivables-date-end').value = '';
    loadReceivablesList();
}

// Abrir modal de detalhes da cobrança
function openReceivableDetails(receivableId) {
    const receivable = receivables.find(r => r.id === receivableId);
    if (!receivable) return;
    
    // Buscar venda relacionada
    const sale = sales.find(s => s.id === receivable.saleId);
    
    // Calcular valores
    const totalGross = receivable.totalGross || 0;
    const totalPaid = receivable.totalPaid || 0;
    const amountDue = receivable.amountDue || 0;
    const balance = amountDue;
    
    // Calcular juros/multa por atraso (preparado para futuro)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(receivable.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const daysOverdue = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
    const lateFee = 0; // Campo preparado para cálculo futuro
    const lateInterest = 0; // Campo preparado para cálculo futuro
    
    // Formatar datas
    let dueDateFormatted = 'Não definida';
    if (receivable.dueDate) {
        if (receivable.dueDate instanceof Date) {
            dueDateFormatted = receivable.dueDate.toLocaleDateString('pt-BR');
        } else {
            dueDateFormatted = formatDate(new Date(receivable.dueDate).toISOString());
        }
    }
    const saleDateFormatted = formatDate(receivable.saleDate);
    
    // Status do vencimento
    const status = getReceivableStatus({ totalPaid: totalPaid, totalGross: totalGross, status: 'open' }, receivable.dueDate, amountDue);
    const statusText = {
        'a-vencer': 'A Vencer',
        'vencido': 'Vencido',
        'pago': 'Pago'
    }[status] || 'A Vencer';
    
    const statusClass = {
        'a-vencer': 'receivable-status-avencer',
        'vencido': 'receivable-status-vencido',
        'pago': 'receivable-status-pago'
    }[status] || 'receivable-status-avencer';
    
    const installmentInfo = receivable.installmentNumber && receivable.totalInstallments 
        ? `Parcela ${receivable.installmentNumber}/${receivable.totalInstallments}` 
        : (receivable.totalInstallments && receivable.totalInstallments > 1 
            ? `${receivable.totalInstallments} parcelas` 
            : 'À vista');
    
    const interestInfo = receivable.interest && receivable.interest > 0
        ? `${receivable.interestType === 'percent' ? receivable.interest + '%' : formatCurrency(receivable.interest)}`
        : 'Nenhum';
    
    const content = `
        <div class="receivable-details">
            <div class="receivable-details-section">
                <h3>👤 Detalhes do Cliente</h3>
                <div class="receivable-details-info">
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Nome:</span>
                        <span class="receivable-details-value">${receivable.clientName}</span>
                    </div>
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Telefone/WhatsApp:</span>
                        <span class="receivable-details-value">${receivable.clientPhone || 'Não informado'}</span>
                    </div>
                </div>
            </div>
            
            <div class="receivable-details-section">
                <h3>💰 Dados da Dívida</h3>
                <div class="receivable-details-info">
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Valor Original:</span>
                        <span class="receivable-details-value">${formatCurrency(totalGross)}</span>
                    </div>
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Valor Pago:</span>
                        <span class="receivable-details-value">${formatCurrency(totalPaid)}</span>
                    </div>
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Saldo Devedor:</span>
                        <span class="receivable-details-value receivable-amount">${formatCurrency(balance)}</span>
                    </div>
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Data da Compra:</span>
                        <span class="receivable-details-value">${saleDateFormatted}</span>
                    </div>
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Data de Vencimento:</span>
                        ${hasReceivablesPermission('alterarVencimento') ? `
                        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                            <input type="date" id="receivable-due-date-input" value="${receivable.dueDate ? (receivable.dueDate instanceof Date ? receivable.dueDate.toISOString().split('T')[0] : new Date(receivable.dueDate).toISOString().split('T')[0]) : ''}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <button class="btn btn-small btn-primary" onclick="updateReceivableDueDate(${receivable.id})" title="Salvar Data de Vencimento">💾 Salvar</button>
                        </div>
                        ` : `
                        <span class="receivable-details-value receivable-due-date ${statusClass}">${dueDateFormatted}</span>
                        `}
                    </div>
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Status:</span>
                        <span class="receivable-status-badge ${statusClass}">${statusText}</span>
                    </div>
                    ${installmentInfo !== 'À vista' ? `
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Parcelamento:</span>
                        <span class="receivable-details-value">${installmentInfo}</span>
                    </div>
                    ` : ''}
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Juros:</span>
                        <span class="receivable-details-value">${interestInfo}</span>
                    </div>
                    ${receivable.paymentMethod ? `
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Forma de Pagamento:</span>
                        <span class="receivable-details-value">${receivable.paymentMethod}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="receivable-details-section">
                <h3>🔗 Venda Relacionada</h3>
                <div class="receivable-details-info">
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Número da Venda:</span>
                        <span class="receivable-details-value">
                            <a href="#" onclick="viewSaleFromReceivable(${receivable.saleId}); return false;" style="color: var(--primary-color); text-decoration: underline;">
                                ${receivable.saleNumber}
                            </a>
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="receivable-details-section">
                <h3>📊 Cálculo de Juros/Multa por Atraso</h3>
                <div class="receivable-details-info">
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Dias em Atraso:</span>
                        <span class="receivable-details-value">${daysOverdue} dias</span>
                    </div>
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Multa por Atraso:</span>
                        <span class="receivable-details-value">${formatCurrency(lateFee)}</span>
                    </div>
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Juros por Atraso:</span>
                        <span class="receivable-details-value">${formatCurrency(lateInterest)}</span>
                    </div>
                    <div class="receivable-details-row">
                        <span class="receivable-details-label">Total com Multa/Juros:</span>
                        <span class="receivable-details-value">${formatCurrency(balance + lateFee + lateInterest)}</span>
                    </div>
                </div>
            </div>
            
            <div class="receivable-details-actions">
                ${balance === 0 ? `
                <button class="btn btn-danger" onclick="deleteReceivable(${receivable.id})">
                    🗑️ Excluir Conta
                </button>
                ` : ''}
                ${hasReceivablesPermission('alterar') && balance > 0 ? `
                <button class="btn btn-success" onclick="openReceivablePaymentModal(${receivable.id})">
                    💰 Registrar Pagamento
                </button>
                ` : ''}
                <button class="btn btn-info" onclick="generateWhatsAppMessage(${receivable.id})">
                    📱 Enviar Lembrete via WhatsApp
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('receivable-details-content').innerHTML = content;
    document.getElementById('receivable-details-modal').style.display = 'block';
}

// Fechar modal de detalhes
function closeReceivableDetailsModal() {
    document.getElementById('receivable-details-modal').style.display = 'none';
}

// Atualizar data de vencimento
function updateReceivableDueDate(receivableId) {
    // Verificar permissão para alterar data de vencimento
    if (!hasReceivablesPermission('alterarVencimento')) {
        alert('⚠️ Você não tem permissão para alterar a data de vencimento.');
        return;
    }
    
    const receivable = receivables.find(r => r.id === receivableId);
    if (!receivable) {
        alert('Erro: Cobrança não encontrada.');
        return;
    }
    
    const newDueDateInput = document.getElementById('receivable-due-date-input');
    if (!newDueDateInput) {
        alert('Erro: Campo de data não encontrado.');
        return;
    }
    
    const newDueDate = newDueDateInput.value;
    if (!newDueDate) {
        alert('Por favor, selecione uma data de vencimento.');
        return;
    }
    
    // Atualizar data de vencimento
    receivable.dueDate = new Date(newDueDate);
    saveReceivables();
    
    alert('Data de vencimento atualizada com sucesso!');
    
    // Recarregar detalhes para atualizar a exibição
    openReceivableDetails(receivableId);
    loadReceivablesList();
}

// Fechar modal ao clicar fora (adicionar event listener sem sobrescrever)
document.addEventListener('DOMContentLoaded', function() {
    const detailsModal = document.getElementById('receivable-details-modal');
    const paymentModal = document.getElementById('receivable-payment-modal');
    
    if (detailsModal) {
        detailsModal.addEventListener('click', function(event) {
            if (event.target === detailsModal) {
                closeReceivableDetailsModal();
            }
        });
    }
    
    if (paymentModal) {
        paymentModal.addEventListener('click', function(event) {
            if (event.target === paymentModal) {
                closeReceivablePaymentModal();
            }
        });
    }
});

// Visualizar venda relacionada
function viewSaleFromReceivable(saleId) {
    closeReceivableDetailsModal();
    // Navegar para a tela de vendas e mostrar a venda
    showSection('inventory');
    showInventoryView('exits');
    // Aqui poderia implementar uma busca/filtro para mostrar a venda específica
    alert(`Venda #${saleId} - Esta funcionalidade pode ser expandida para mostrar os detalhes da venda.`);
}

// Abrir modal de pagamento
let currentReceivablePaymentId = null;
function openReceivablePaymentModal(receivableId) {
    // Verificar permissão para alterar dados
    if (!hasReceivablesPermission('alterar')) {
        alert('⚠️ Você não tem permissão para registrar pagamentos.');
        return;
    }
    
    currentReceivablePaymentId = receivableId;
    const receivable = receivables.find(r => r.id === receivableId);
    if (!receivable) return;
    
    const amountDue = receivable.amountDue || 0;
    document.getElementById('payment-amount').value = amountDue.toFixed(2);
    document.getElementById('payment-amount').max = amountDue;
    
    // Definir data atual como padrão
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('payment-date').value = today;
    document.getElementById('payment-notes').value = '';
    
    document.getElementById('receivable-payment-modal').style.display = 'block';
}

// Fechar modal de pagamento
function closeReceivablePaymentModal() {
    document.getElementById('receivable-payment-modal').style.display = 'none';
    currentReceivablePaymentId = null;
}

// Confirmar pagamento
function confirmReceivablePayment() {
    if (!currentReceivablePaymentId) return;
    
    const receivable = receivables.find(r => r.id === currentReceivablePaymentId);
    if (!receivable) {
        alert('Erro: Cobrança não encontrada.');
        return;
    }
    
    const paymentAmount = parseFloat(document.getElementById('payment-amount').value) || 0;
    const paymentDate = document.getElementById('payment-date').value;
    const paymentNotes = document.getElementById('payment-notes').value;
    
    if (paymentAmount <= 0) {
        alert('Por favor, informe um valor válido maior que zero.');
        return;
    }
    
    const amountDue = receivable.amountDue || 0;
    if (paymentAmount > amountDue) {
        alert(`O valor informado (${formatCurrency(paymentAmount)}) não pode ser maior que o valor devido (${formatCurrency(amountDue)}).`);
        return;
    }
    
    // Atualizar venda relacionada
    const sale = sales.find(s => s.id === receivable.saleId);
    if (sale) {
        sale.totalPaid = (sale.totalPaid || 0) + paymentAmount;
        if (sale.totalPaid >= sale.totalGross) {
            sale.status = 'completed';
        } else {
            sale.status = 'partial';
        }
        saveSales();
    }
    
    // Atualizar receivable
    receivable.amountDue = amountDue - paymentAmount;
    receivable.totalPaid = (receivable.totalPaid || 0) + paymentAmount;
    
    if (receivable.amountDue <= 0) {
        receivable.status = 'paid';
        receivable.amountDue = 0;
    }
    
    // Adicionar histórico de pagamento
    if (!receivable.paymentHistory) {
        receivable.paymentHistory = [];
    }
    receivable.paymentHistory.push({
        amount: paymentAmount,
        date: paymentDate,
        notes: paymentNotes,
        createdAt: new Date().toISOString()
    });
    
    saveReceivables();
    
    alert('Pagamento registrado com sucesso!');
    closeReceivablePaymentModal();
    closeReceivableDetailsModal();
    loadReceivablesList();
}

// Gerar mensagem para WhatsApp
function generateWhatsAppMessage(receivableId) {
    const receivable = receivables.find(r => r.id === receivableId);
    if (!receivable) return;
    
    const clientName = receivable.clientName;
    const clientPhone = receivable.clientPhone || '';
    const amountDue = formatCurrency(receivable.amountDue);
    
    let dueDateFormatted = 'Não definida';
    if (receivable.dueDate) {
        if (receivable.dueDate instanceof Date) {
            dueDateFormatted = receivable.dueDate.toLocaleDateString('pt-BR');
        } else {
            dueDateFormatted = formatDate(new Date(receivable.dueDate).toISOString());
        }
    }
    
    const saleNumber = receivable.saleNumber;
    
    const message = `Olá ${clientName}!

Lembramos que você possui uma pendência financeira conosco:

📋 Número da Venda: ${saleNumber}
💰 Valor Devido: ${amountDue}
📅 Data de Vencimento: ${dueDateFormatted}

Por favor, entre em contato conosco para regularizar sua situação.

Agradecemos a compreensão!`;
    
    // Copiar mensagem para área de transferência
    navigator.clipboard.writeText(message).then(() => {
        alert('✅ Mensagem copiada para a área de transferência!\n\nAgora você pode colar e enviar via WhatsApp.');
    }).catch(() => {
        // Fallback para navegadores mais antigos
        const textarea = document.createElement('textarea');
        textarea.value = message;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('✅ Mensagem copiada para a área de transferência!\n\nAgora você pode colar e enviar via WhatsApp.');
    });
    
    // Se tiver telefone, abrir WhatsApp Web
    if (clientPhone) {
        const phoneNumber = clientPhone.replace(/\D/g, ''); // Remove caracteres não numéricos
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    }
}

// Excluir conta a receber
function deleteReceivable(receivableId) {
    const receivable = receivables.find(r => r.id === receivableId);
    if (!receivable) {
        alert('Erro: Conta não encontrada.');
        return;
    }
    
    const amountDue = receivable.amountDue || 0;
    if (amountDue > 0) {
        alert('⚠️ Não é possível excluir uma conta que ainda possui valor a receber.');
        return;
    }
    
    if (!confirm(`Tem certeza que deseja excluir esta conta?\n\nCliente: ${receivable.clientName}\nNúmero da Venda: ${receivable.saleNumber}\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    
    // Remover do array
    const index = receivables.findIndex(r => r.id === receivableId);
    if (index !== -1) {
        receivables.splice(index, 1);
        saveReceivables();
        loadReceivablesList();
        alert('Conta excluída com sucesso!');
    }
}
