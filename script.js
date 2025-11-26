// Armazenamento de dados
let clients = JSON.parse(localStorage.getItem('clients')) || [];
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
document.addEventListener('DOMContentLoaded', () => {
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
      // O checkLoginStatus() irá carregar o tema do usuário se ele estiver logado
      applyDefaultTheme();
      
      // Após verificar o login, carregar tema do usuário se estiver logado
      setTimeout(() => {
          if (currentUser && currentUser.username) {
              loadUserTheme();
              setupThemeColorPicker();
          }
      }, 100);
  });

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

    // Cards do dashboard (Clientes Cadastrados e Aniversários Hoje)
    const totalClientsCard = document.querySelector('.stat-card:nth-child(1)');
    const todayBirthdaysCard = document.querySelector('.stat-card:nth-child(2)');

    if (totalClientsCard) {
        totalClientsCard.style.cursor = 'pointer';
        totalClientsCard.addEventListener('click', () => {
            if (isLicenseExpired()) {
                showSection('license');
                return;
            }
            showSection('all-clients');
            showClientsListView();
        });
    }

    if (todayBirthdaysCard) {
        todayBirthdaysCard.style.cursor = 'pointer';
        todayBirthdaysCard.addEventListener('click', () => {
            if (isLicenseExpired()) {
                showSection('license');
                return;
            }
            showSection('greetings');
        });
    }

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
        const allowedSections = ['home', 'greetings', 'all-clients', 'support'];
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
    
    // Verificar permissões de acesso baseado no nível do usuário
    if (currentUser && !hasAccessToSection(sectionId)) {
        alert('⚠️ Acesso negado! Você não tem permissão para acessar esta funcionalidade. Apenas administradores podem acessar este menu.');
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
    } else if (sectionId === 'greetings') {
        loadClients();
    } else if (sectionId === 'license-status') {
        updateLicenseStatus();
    } else if (sectionId === 'license') {
        updateLicenseExpirationMessage();
    } else if (sectionId === 'home') {
        updateLicenseExpirationMessage();
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
    } else if (sectionId === 'birthday-card-settings') {
        loadBirthdayCardSettingsIntoForm();
    } else if (sectionId === 'button-settings') {
        loadButtonSettingsForm();
    } else if (sectionId === 'company') {
        loadCompanyData();
        updateCompanyHeader();
    }
    
    // Atualizar visibilidade dos menus de "Mais Opções" sempre que mudar de seção
    updateMoreOptionsVisibility();
}

// Atualizar visibilidade dos cards de "Mais Opções" baseado no nível de acesso
function updateMoreOptionsVisibility() {
    const moreOptionsGrid = document.querySelector('.more-options-grid');
    if (!moreOptionsGrid) return;
    
    const optionCards = moreOptionsGrid.querySelectorAll('.option-card');
    optionCards.forEach(card => {
        const onclickAttr = card.getAttribute('onclick');
        if (!onclickAttr) return;
        
        // Extrair o sectionId do onclick
        const match = onclickAttr.match(/showSection\('([^']+)'\)/);
        if (!match) return;
        
        const sectionId = match[1];
        
        // Se for funcionário, esconder todos os cards exceto "Suporte"
        if (isFuncionario()) {
            if (sectionId === 'support') {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        } else {
            // Administradores veem todos os cards
            card.style.display = 'block';
        }
    });
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
            <div class="client-card ${cardClass}">
                <div class="client-card-header">
                    ${photoHtml}
                    <h3>${client.name}</h3>
                </div>
                ${client.cpf ? `<div class="client-info"><strong>CPF:</strong> ${client.cpf}</div>` : ''}
                <div class="client-info"><strong>Data de Nascimento:</strong> ${formatDate(client.birthdate)}</div>
                ${getBirthdayDaysIndicator(client)}
                <div class="client-actions">
                    ${isAdmin() ? `
                        <button class="btn btn-edit" onclick="openEditModal('${client.id}')">Editar</button>
                        <button class="btn btn-delete" onclick="deleteClient('${client.id}')">Excluir</button>
                    ` : ''}
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
        document.getElementById('company-logo').src = companyData.logo;
        document.getElementById('company-logo').style.display = 'block';
        document.getElementById('logo-preview').src = companyData.logo;
        document.getElementById('logo-preview').style.display = 'block';
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
    const logoEl = document.getElementById('company-logo');
    if (logoEl && companyData.logo) {
        logoEl.src = companyData.logo;
        logoEl.style.display = 'block';
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
    
    // Abrir modal de cropping com aspect ratio 1:1 (quadrado) para logo
    openCropModal(file, 'logo', 1, (croppedImageData) => {
        companyData.logo = croppedImageData;
        document.getElementById('company-logo').src = croppedImageData;
        document.getElementById('company-logo').style.display = 'block';
        document.getElementById('logo-preview').src = croppedImageData;
        document.getElementById('logo-preview').style.display = 'block';
        document.getElementById('remove-logo-btn').style.display = 'inline-block';
        saveCompanyData();
        updateCompanyHeader();
        alert('Logo atualizado com sucesso!');
    });
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
            'theme-bg': 'Ajustar Fundo do Tema'
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
        width: currentCropType === 'logo' ? 400 : (currentCropType === 'header-bg' ? 1200 : 800),
        height: currentCropType === 'logo' ? 400 : (currentCropType === 'header-bg' ? 300 : 600),
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
        saveCompanyData();
        updateCompanyHeader();
        document.getElementById('logo-preview').style.display = 'none';
        document.getElementById('logo-preview').src = '';
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

    document.documentElement.style.setProperty('--nav-btn-bg', bg);
    document.documentElement.style.setProperty('--nav-btn-text', buttonStyleSettings.textColor);
    document.documentElement.style.setProperty('--nav-btn-border-color', borderColor);
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


// Backup dos dados
function downloadBackup() {
    const backupData = {
        clients,
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
        
        // Funcionários não podem editar ou excluir usuários
        let editBtn = '';
        let deleteBtn = '';
        
        if (isProtectedUser) {
            // Usuários protegidos (Coutinho e admin) não podem ser excluídos
            deleteBtn = '';
            
            // Edição só permitida para o próprio usuário
            if (isCoutinhoUser) {
                editBtn = loggedIsCoutinho ? 
                    `<button class="btn btn-edit" onclick="openEditUserModal('${user.id}')">✏️ Editar</button>` :
                    '<button class="btn btn-edit" onclick="alert(\'Somente o usuário Coutinho pode editar seus próprios dados.\')" title="Restrito">✏️ Editar</button>';
            } else if (isAdminUser) {
                editBtn = loggedIsAdmin ? 
                    `<button class="btn btn-edit" onclick="openEditUserModal('${user.id}')">✏️ Editar</button>` :
                    '<button class="btn btn-edit" onclick="alert(\'Somente o usuário admin pode editar seus próprios dados.\')" title="Restrito">✏️ Editar</button>';
            } else {
                editBtn = '<button class="btn btn-edit" onclick="alert(\'Este usuário não pode ser editado.\')" title="Usuário protegido">✏️ Editar</button>';
            }
        } else if (isAdmin()) {
            // Administradores podem editar e excluir outros usuários (não protegidos)
            editBtn = `<button class="btn btn-edit" onclick="openEditUserModal('${user.id}')">✏️ Editar</button>`;
            deleteBtn = `<button class="btn btn-delete" onclick="deleteUser('${user.id}')">🗑️ Excluir</button>`;
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

