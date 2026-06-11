import { useState, useEffect } from 'react'
import { apiClient } from '../services/api'

const MAX_UPLOAD_WIDTH = 1024

function getImageSize(file) {
	return new Promise((resolve, reject) => {
		const imageUrl = URL.createObjectURL(file)
		const img = new Image()
		img.onload = () => {
			URL.revokeObjectURL(imageUrl)
			resolve({ width: img.naturalWidth, height: img.naturalHeight })
		}
		img.onerror = () => {
			URL.revokeObjectURL(imageUrl)
			reject(new Error('Unable to read image dimensions'))
		}
		img.src = imageUrl
	})
}

function resizeImageFile(file, targetWidth, targetHeight) {
	return new Promise((resolve, reject) => {
		const imageUrl = URL.createObjectURL(file)
		const img = new Image()
		img.onload = () => {
			URL.revokeObjectURL(imageUrl)
			const canvas = document.createElement('canvas')
			canvas.width = targetWidth
			canvas.height = targetHeight
			const ctx = canvas.getContext('2d')
			ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
			canvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Image resize failed'))
					return
				}
				resolve(new File([blob], file.name, { type: file.type || 'image/jpeg' }))
			}, file.type || 'image/jpeg', 0.92)
		}
		img.onerror = () => {
			URL.revokeObjectURL(imageUrl)
			reject(new Error('Unable to load image for resize'))
		}
		img.src = imageUrl
	})
}

async function createPendingImage(file) {
	const { width, height } = await getImageSize(file)
	const aspectRatio = width && height ? width / height : 1
	const initialWidth = Math.min(width, MAX_UPLOAD_WIDTH)
	const initialHeight = Math.max(1, Math.round(initialWidth / aspectRatio))
	const uploadFile = initialWidth < width ? await resizeImageFile(file, initialWidth, initialHeight) : file
	return {
		id: `${file.name}-${file.size}-${file.lastModified}`,
		file: uploadFile,
		originalFile: file,
		previewUrl: URL.createObjectURL(file),
		naturalWidth: width,
		naturalHeight: height,
		width: initialWidth,
		height: initialHeight,
		aspectRatio,
	}
}

export default function NoteModal({ initial, onCancel, onSave }) {
	const [title, setTitle] = useState(initial?.title || '')
	const [body, setBody] = useState(initial?.body || '')
	const [error, setError] = useState('')
	const [uploading, setUploading] = useState(false)
	const [pendingImages, setPendingImages] = useState([])
	const [uploadedImages, setUploadedImages] = useState([])

	useEffect(() => {
		return () => {
			pendingImages.forEach(image => URL.revokeObjectURL(image.previewUrl))
			uploadedImages.forEach(image => URL.revokeObjectURL(image.previewUrl))
		}
	}, [pendingImages, uploadedImages])

	async function handleImageUpload(e) {
		const files = Array.from(e.target.files || [])
		if (files.length === 0) return

		setError('')
		setUploading(true)
		try {
			const newPending = []
			for (const file of files) {
				const image = await createPendingImage(file)
				newPending.push(image)
			}
			setPendingImages(current => [...current, ...newPending])
		} catch (err) {
			setError('Failed to prepare image: ' + err.message)
		} finally {
			setUploading(false)
		}
	}

	async function updatePendingImageSize(imageId, newWidth) {
		const image = pendingImages.find(item => item.id === imageId)
		if (!image) return

		setError('')
		setUploading(true)
		try {
			const newHeight = Math.max(1, Math.round(newWidth / image.aspectRatio))
			const resizedFile = await resizeImageFile(image.originalFile, newWidth, newHeight)
			setPendingImages(current => current.map(item => item.id === imageId ? {
				...item,
				file: resizedFile,
				width: newWidth,
				height: newHeight,
			} : item))
		} catch (err) {
			setError('Failed to resize image: ' + err.message)
		} finally {
			setUploading(false)
		}
	}

	async function uploadPendingImages() {
		if (!initial?.id || pendingImages.length === 0) return true

		setError('')
		setUploading(true)
		try {
			for (const image of pendingImages) {
				const res = await apiClient.uploadImage(initial.id, image.file)
				setBody(res.note?.note_body || body)
				setUploadedImages(current => [...current, {
					...image,
					uploaded: true,
				}])
			}
			setPendingImages([])
			return true
		} catch (err) {
			setError('Failed to upload image: ' + err.message)
			return false
		} finally {
			setUploading(false)
		}
	}

	function removePendingImage(imageId) {
		setPendingImages(current => {
			const remaining = current.filter(image => image.id !== imageId)
			const removed = current.find(image => image.id === imageId)
			if (removed) {
				URL.revokeObjectURL(removed.previewUrl)
			}
			return remaining
		})
	}

	function removeUploadedImage(imageId) {
		setUploadedImages(current => {
			const remaining = current.filter(image => image.id !== imageId)
			const removed = current.find(image => image.id === imageId)
			if (removed) {
				URL.revokeObjectURL(removed.previewUrl)
			}
			return remaining
		})
	}

	async function handleVoiceUpload(e) {
		const file = e.target.files?.[0]
		if (!file || !initial?.id) return

		setUploading(true)
		try {
			const res = await apiClient.uploadVoice(initial.id, file)
			setBody(res.note?.note_body || body)
		} catch (err) {
			setError('Failed to upload voice: ' + err.message)
		} finally {
			setUploading(false)
		}
	}

	function handleBodyChange(e) {
		setBody(e.target.value)
		// Force LTR direction on input
		if (e.target.getAttribute('dir') !== 'ltr') {
			e.target.setAttribute('dir', 'ltr')
		}
	}

	function handleTitleChange(e) {
		setTitle(e.target.value)
		// Force LTR direction on input
		if (e.target.getAttribute('dir') !== 'ltr') {
			e.target.setAttribute('dir', 'ltr')
		}
	}

	async function submit(e) {
		e.preventDefault()
		setError('')

		const trimmedTitle = title.trim()
		const trimmedBody = body.trim()

		if (!trimmedTitle || !trimmedBody) {
			setError('Title and body are required')
			return
		}

		if (trimmedBody.length > 1000) {
			setError('Body must be less than 1000 characters')
			return
		}

		if (pendingImages.length > 0 && trimmedBody.length + pendingImages.length * 8 > 1000) {
			setError('Body plus images must be less than 1000 characters')
			return
		}

		if (initial?.id && pendingImages.length > 0) {
			const uploaded = await uploadPendingImages()
			if (!uploaded) {
				return
			}
		}

		onSave({
			...initial,
			title: trimmedTitle,
			body: trimmedBody,
			id: initial?.id,
			pendingImages: initial?.id ? undefined : pendingImages,
		})
	}

	return (
		<div className="modal">
			<form className="modal-content" onSubmit={submit}>
				<div className="modal-header">
					<h3>{initial ? 'Edit Note' : 'New Note'}</h3>
				</div>
				{error && <div className="modal-error">{error}</div>}
				<label className="field">
					Title
					<input
						dir="ltr"
						autoComplete="off"
						spellCheck="false"
						placeholder="Give it a short title (min 1 char)"
						value={title}
						onChange={handleTitleChange}
					/>
					<span className="char-count">{title.length}/100</span>
				</label>
				<label className="field">
					Body
					<textarea
						dir="ltr"
						spellCheck="false"
						placeholder="Write your note here..."
						value={body}
						onChange={handleBodyChange}
					/>
					<span className="char-count">{body.length}/1000</span>
				</label>

				<div className="media-section">
					<div className="media-upload">
						<label className="btn secondary">
							📷 Add Image
							<input
								type="file"
								accept="image/*"
								onChange={handleImageUpload}
								disabled={uploading}
								style={{ display: 'none' }}
								multiple={true}
							/>
						</label>
						<label className="btn secondary">
							🎙️ Add Voice
							<input
								type="file"
								accept="audio/*"
								onChange={handleVoiceUpload}
								disabled={uploading}
								style={{ display: 'none' }}
							/>
						</label>
					</div>

					{uploadedImages.length > 0 && (
						<div className="media-list">
							<h4>Uploaded Images ({uploadedImages.length})</h4>
							<div className="images-grid">
								{uploadedImages.map(image => (
									<div key={image.id} className="pending-image-card">
										<img
											src={image.previewUrl}
											alt="Uploaded image"
											className="media-thumbnail"
										/>
										<button
											type="button"
											className="btn ghost"
											onClick={() => removeUploadedImage(image.id)}
										>
											Remove
										</button>
									</div>
								))}
							</div>
						</div>
					)}

					{pendingImages.length > 0 && initial?.id && (
						<div className="upload-pending-actions">
							<button
								type="button"
								className="btn primary"
								disabled={uploading}
								onClick={uploadPendingImages}
							>
								Upload Selected Images
							</button>
							<span className="upload-hint">Resize images below before uploading.</span>
						</div>
					)}

					{pendingImages.length > 0 && (
						<div className="media-list">
							<h4>Pending Images ({pendingImages.length})</h4>
							<div className="images-grid">
								{pendingImages.map(image => (
									<div key={image.id} className="pending-image-card">
										<img
											src={image.previewUrl}
											alt="Pending image"
											className="media-thumbnail"
										/>
										<div className="resize-controls">
											<label>
												Resize width
												<input
													type="range"
													min="100"
													max={image.naturalWidth}
													step="10"
													value={image.width}
													onChange={e => updatePendingImageSize(image.id, Number(e.target.value))}
												/>
											</label>
											<div>{image.width} x {image.height}px</div>
										</div>
										<button
											type="button"
											className="btn ghost"
											onClick={() => removePendingImage(image.id)}
										>
											Remove
										</button>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="modal-actions">
					<button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
					<button type="submit" className="btn primary" disabled={uploading}>
						{uploading ? 'Uploading...' : 'Save'}
					</button>
				</div>
			</form>
		</div>
	)
}
