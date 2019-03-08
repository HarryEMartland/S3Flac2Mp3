const AWS = require('aws-sdk');
var s3 = new AWS.S3();
var sqs = new AWS.SQS();
const fs = require('fs');
const exec = require('child_process').exec;

exports.handler = function(event, context, callback) {
    event = JSON.parse(event.Records[0].body);
    console.log(JSON.stringify(event));

    if (event.Records.length > 1) {
        return Promise.all(event.Records.map(record => {
            event.Records = [record];
            return sqs.sendMessage({
                MessageBody: JSON.stringify(event),
                QueueUrl: 'https://sqs.eu-west-1.amazonaws.com/818032293643/flac2mp3',
                DelaySeconds: 0,
            }).promise()
        }))
    }

    const srcBucket = event.Records[0].s3.bucket.name;
    const srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

    console.log(`Reading ${srcBucket}/${srcKey}`)
    const startTime = Date.now();

    s3.getObject({ Bucket: srcBucket, Key: srcKey }).promise()
        .then(object => {
            const getObject = Date.now() - startTime;
            console.log(`{getObject: ${getObject}`)

            fs.writeFile("/tmp/test.flac", object.Body, function(err) {
                    console.log("The file was saved!");
                    if (err) {
                        console.log(err);
                        callback(err)
                    }

                    const writeFile = Date.now() - startTime - getObject;
                    console.log(`{writeFile: ${writeFile}`)

                    const child = exec('/opt/ffmpeg -i /tmp/test.flac /tmp/test.mp3',
                        (error, stdout, stderr) => {

                            if (error !== null) {
                                console.log(`exec error: ${error}`);
                            }


                            const convert = Date.now() - startTime - getObject - writeFile;
                            console.log(`{convert: ${convert}`)

                            var params = {
                                Body: fs.readFileSync('/tmp/test.mp3'),
                                Bucket: srcBucket,
                                Key: srcKey.replace('.flac', '.mp3')
                            };
                            s3.putObject(params, function(err, data) {
                                if (err) console.log(err, err.stack); // an error occurred
                                else console.log(data); // successful response

                            });

                        });
                }

            );


        });
}
