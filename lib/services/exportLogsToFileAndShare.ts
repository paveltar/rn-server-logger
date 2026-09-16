
//@ts-nocheck
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import moment from 'moment';

const exportLogsToFileAndShare = async (logs) => {
    let txtFile = '';
    logs.sort((a, b) => b.timestamp - a.timestamp).forEach((point) => {
        const { type, timestamp, url, requestData, responseData, status, message, error } = point;
        // Fields a log does not have (MESSAGE for HTTP logs, the rest for PRINT logs) are left out
        const fields = [
            ['TYPE', type],
            ['TIME', moment(timestamp).format('DD-MM-YY HH:mm:ss.SSS')],
            ['MESSAGE', message],
            ['URL', url],
            ['REQUEST DATA', requestData],
            ['RESPONSE DATA', responseData],
            ['STATUS', status],
            ['ERROR', error],
        ].filter(([, value]) => value !== undefined);
        txtFile += `
    ${fields.map(([label, value]) => `${label}: ${value}\n`).join('\n    ')}
    ---------------------------------
    \n
    `;
    });

    const filename = 'logs.txt';
    const filepath = `${(RNFS.CachesDirectoryPath)}/${filename}`;
    await RNFS.writeFile(filepath, txtFile, 'utf8');
    await Share.open({ url: `file://${filepath}` });
};

export default exportLogsToFileAndShare;
