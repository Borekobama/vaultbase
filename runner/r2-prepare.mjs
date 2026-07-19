import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const endpoint = process.env.R2_ENDPOINT
const bucket = process.env.R2_BUCKET
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error('R2_ENDPOINT, R2_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are required.')
  process.exit(1)
}

const client = new S3Client({
  endpoint,
  region: 'auto',
  credentials: { accessKeyId, secretAccessKey },
})

const key = `_vaultbase/setup-check-${Date.now()}.txt`
const body = `Vaultbase R2 permission check ${new Date().toISOString()}\n`

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }))
  const before = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 10 }))
  console.log(`Bucket reachable. Existing objects sampled: ${before.KeyCount ?? 0}`)

  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'text/plain' }))
  await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  const downloaded = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const downloadedBody = await downloaded.Body?.transformToString()
  if (downloadedBody !== body) throw new Error('R2 returned different content than was uploaded.')
  console.log('Object write, metadata read, and content read succeeded.')
} finally {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    console.log('Temporary setup object deleted.')
  } catch (error) {
    console.error(`Could not delete temporary object ${key}.`, error)
    process.exitCode = 1
  }
}
