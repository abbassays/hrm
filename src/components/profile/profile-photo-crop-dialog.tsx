'use client';

import { useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

import { createCroppedProfilePhoto } from '@/lib/crop-image';
import Logger from '@/utils/logger';

type ProfilePhotoCropDialogProps = {
  file: File;
  imageUrl: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export function ProfilePhotoCropDialog({
  file,
  imageUrl,
  onCancel,
  onConfirm,
}: ProfilePhotoCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const confirmCrop = async () => {
    if (!croppedArea) return;

    setIsProcessing(true);
    try {
      const croppedFile = await createCroppedProfilePhoto(
        imageUrl,
        croppedArea,
        file,
      );
      onConfirm(croppedFile);
    } catch (error) {
      Logger.error('Could not crop profile photo', error);
      toast.error('Could not prepare that photo. Please try another image.');
      setIsProcessing(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isProcessing) onCancel();
      }}
    >
      <DialogContent className='data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Adjust profile photo</DialogTitle>
          <DialogDescription>
            Drag and zoom the photo until it fits inside the circle.
          </DialogDescription>
        </DialogHeader>

        <div className='relative h-72 overflow-hidden rounded-md bg-muted sm:h-80'>
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape='round'
            showGrid={false}
            roundCropAreaPixels
            onCropChange={setCrop}
            onCropComplete={(_, cropPixels) => setCroppedArea(cropPixels)}
            onZoomChange={setZoom}
            mediaProps={{ 'aria-label': 'Profile photo crop preview' }}
          />
        </div>

        <div className='flex items-center gap-4'>
          <Label htmlFor='profile-photo-zoom' className='shrink-0'>
            Zoom
          </Label>
          <Slider
            id='profile-photo-zoom'
            aria-label='Zoom profile photo'
            min={1}
            max={3}
            step={0.01}
            value={[zoom]}
            onValueChange={(value) => {
              const nextZoom = value[0];
              if (nextZoom !== undefined) setZoom(nextZoom);
            }}
          />
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type='button'
            onClick={confirmCrop}
            disabled={!croppedArea}
            isLoading={isProcessing}
          >
            Save photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
