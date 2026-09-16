
//@ts-nocheck
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import moment from 'moment';

const SEPARATOR = '---------------------------------';

const exportLogsToFileAndShare = async (logs) => {
    // Newest first; fields a log does not have (MESSAGE for HTTP logs, the rest for PRINT logs) are left out
    const entries = [...logs].sort((a, b) => b.id - a.id).map((log) => {
        const { type, timestamp, url, requestData, responseData, status, message, error } = log;
        return [
            ['TYPE', type],
            ['TIME', moment(timestamp).format('DD-MM-YY HH:mm:ss.SSS')],
            ['MESSAGE', message],
            ['URL', url],
            ['REQUEST DATA', requestData],
            ['RESPONSE DATA', responseData],
            ['STATUS', status],
            ['ERROR', error],
        ]
            .filter(([, value]) => value !== undefined)
            .map(([label, value]) => `${label}: ${value}`)
            .join('\n');
    });
    const txtFile = entries.map((entry) => `${entry}\n${SEPARATOR}\n\n`).join('');

    const filename = 'logs.txt';
    const filepath = `${(RNFS.CachesDirectoryPath)}/${filename}`;
    await RNFS.writeFile(filepath, txtFile, 'utf8');
    await Share.open({ url: `file://${filepath}` });
};

export default exportLogsToFileAndShare;
