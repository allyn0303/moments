import type {ResultVO, SysConfigVO} from "~/types";
import {toast} from "vue-sonner";
import {useGlobalState} from "~/store";

const global = useGlobalState()

export async function useMyFetch<T>(url: string, data?: any) {
    const userinfo = global.value.userinfo
    const headers: Record<string, any> = {}
    if (userinfo.token) {
        headers["x-api-token"] = userinfo.token
    }
    try {
        const res = await $fetch<ResultVO<T>>(`/api${url}`, {
            method: "post",
            body: data ? JSON.stringify(data) : null,
            headers: headers
        })
        if (res.code !== 0) {
            if (res.code === 3){
                global.value.userinfo = {}
                window.location.reload()
                return
            }
            toast.error(res.message || "请求失败")
            throw new Error(res.message)
        }
        return res.data
    } catch (e) {
        if (e instanceof Error) {
            throw new Error(e.message)
        }
        throw new Error("接口异常")
    }
}

async function upload2S3(files: FileList, onProgress: Function) {
    const result = []
    for (let i = 0; i < files.length; i++) {
        const {preSignedUrl, imageUrl} = await useMyFetch<{
            preSignedUrl: string,
            imageUrl: string
        }>('/file/s3PreSigned', {
            contentType: files[0].type
        })
        await upload2S3WithProgress(preSignedUrl, files[i], (name: string, progress: number) => {
            onProgress(files.length, i + 1, name, progress)
        })
        result.push(imageUrl)
    }
    return result
}

const upload2S3WithProgress = async (preSignedUrl: string, file: File, onProgress: Function) => {
    new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', e => onProgress(file.name, e.loaded / e.total));
        xhr.addEventListener('load', () => resolve(JSON.parse(xhr.responseText)));
        xhr.addEventListener('error', () => reject(new Error('File upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('File upload aborted')));
        xhr.open('PUT', preSignedUrl, true);
        //@ts-ignore
        xhr.setRequestHeader('Content-Type', null);
        xhr.send(file);
    })
}


export async function useUpload(files: FileList | null, onProgress: Function) {
    const sysConfig = useState<SysConfigVO>('sysConfig')
    const result = []
    if (!files || files.length === 0) {
        toast.error("没有选择文件")
        return
    }

    const userinfo = global.value.userinfo
    const headers: Record<string, any> = {}
    if (userinfo.token) {
        headers["x-api-token"] = userinfo.token
    }

    if (sysConfig.value.enableS3) {
        return await upload2S3(files,onProgress)
    }
    for (let i = 0; i < files.length; i++) {
        try {
            const res = await uploadFiles('/api/file/upload', files[i], (name: string, progress: number) => {
                onProgress(files.length, i + 1, name, progress)
            }) as {
                code: number,
                data: string[],
                message: string
            }
            if (res.code !== 0) {
                toast.error(res.message || "请求失败")
                throw new Error(res.message)
            }
            result.push(...res.data)
        } catch (e) {
            if (e instanceof Error) {
                throw new Error(e.message)
            }
            throw new Error("接口异常")
        }
    }
    return result
}


export const uploadFiles = (url: string, file: File, onProgress: Function) =>
    new Promise((resolve, reject) => {
        const userinfo = global.value.userinfo
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', e => onProgress(file.name, e.loaded / e.total));
        xhr.addEventListener('load', () => resolve(JSON.parse(xhr.responseText)));
        xhr.addEventListener('error', () => reject(new Error('File upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('File upload aborted')));
        xhr.open('POST', url, true);
        if (userinfo.token) {
            xhr.setRequestHeader('x-api-token', userinfo.token);
        }
        const formData = new FormData();
        formData.append("files", file)
        xhr.send(formData);
    });