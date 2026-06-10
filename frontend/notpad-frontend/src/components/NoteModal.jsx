import { useState, useEffect } from 'react'
import { apiClient } from '../services/api'

export default function NoteModal({ initial, onCancel, onSave }) {
	const [title, setTitle] = useState(initial?.title || '')
	const [body, setBody] = useState(initial?.body || '')
	const [error, setError] = useState('')
	const [uploading, setUploading] = useState(false)
	const [images, setImages] = useState(initial?.images || [])
	const [voices, setVoices] = useState(initial?.voices || [])

	useEffect(() => {
		if (initial?.id && initial?.images?.length === 0) {
			// Load images if not already loaded
			apiClient.getNoteImages(initial.id)
				.then(res => setImages(res.images || []))
				.catch(() => setImages([]))
		}
		if (initial?.id && initial?.voices?.length === 0) {
			// Load voices if not already loaded
			apiClient.getNoteVoices(initial.id)
				.then(res => setVoices(res.voices || []))
				.catch(() => setVoices([]))
		}
	}, [initial?.id])

	async function handleImageUpload(e) {
		const file = e.target.files?.[0]
		if (!file || !initial?.id) return

		setUploading(true)
		try {
			await apiClient.uploadImage(initial.id, file)
			const updatedImages = await apiClient.getNoteImages(initial.id)
			setImages(updatedImages.images || [])
		} catch (err) {
			setError('Failed to upload image: ' + err.message)
		} finally {
			setUploading(false)
		}
	}

	async function handleVoiceUpload(e) {
		const file = e.target.files?.[0]
		if (!file || !initial?.id) return

		setUploading(true)
		try {
			await apiClient.uploadVoice(initial.id, file)
			const updatedVoices = await apiClient.getNoteVoices(initial.id)
			setVoices(updatedVoices.voices || [])
		} catch (err) {
			setError('Failed to upload voice: ' + err.message)
		} finally {
			setUploading(false)
		}
	}

	function submit(e) {
		e.preventDefault()
		setError('')

		const trimmedTitle = title.trim()
		const trimmedBody = body.trim()

		if (!trimmedTitle || !trimmedBody) {
			setError('Title and body are required')
			return
		}

		if (trimmedTitle.length < 1) {
			setError('Title must be at least 1 character')
			return
		}

		if (trimmedBody.length > 1000) {
			setError('Body must be less than 1000 characters')
			return
		}

		onSave({ ...initial, title: trimmedTitle, body: trimmedBody, id: initial?.id })
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
						placeholder="Give it a short title (min 1 char)"
						value={title}
						onChange={e => setTitle(e.target.value)}
					/>
					<span className="char-count">{title.length}/100</span>
				</label>
				<label className="field">
					Body
					<textarea
						placeholder="Write your note here..."
						value={body}
						onChange={e => setBody(e.target.value)}
					/>
					<span className="char-count">{body.length}/1000</span>
				</label>

				{initial?.id && (
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

						{images.length > 0 && (
							<div className="media-list">
								<h4>Images ({images.length})</h4>
								<div className="images-grid">
									{images.map(img => (
										<img
											key={img.picture_id}
											src={img.picture_url}
											alt="Note"
											className="media-thumbnail"
										/>
									))}
								</div>
							</div>
						)}

						{voices.length > 0 && (
							<div className="media-list">
								<h4>Voices ({voices.length})</h4>
								{voices.map(voice => (
									<audio
										key={voice.voice_id}
										src={voice.voice_url}
										controls
										className="media-audio"
									/>
								))}
							</div>
						)}
					</div>
				)}

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
