import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FlipHorizontal, FlipVertical, RotateCcw, RotateCw } from 'lucide-react';
import type { CameraSettings } from '@/types';

interface CameraSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: CameraSettings;
    onChange: (settings: CameraSettings) => void;
}

export function CameraSettingsModal({ isOpen, onClose, settings, onChange }: CameraSettingsModalProps) {
    const handleRotateLeft = () => {
        onChange({ ...settings, rotation: (settings.rotation - 90) % 360 });
    };

    const handleRotateRight = () => {
        onChange({ ...settings, rotation: (settings.rotation + 90) % 360 });
    };

    const handleFlipHorizontal = () => {
        onChange({ ...settings, flipH: !settings.flipH });
    };

    const handleFlipVertical = () => {
        onChange({ ...settings, flipV: !settings.flipV });
    };

    const handleReset = () => {
        onChange({ flipH: false, flipV: false, rotation: 0 });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-neutral-900 border-neutral-800 rounded-none max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-white">Camera Settings</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            onClick={handleFlipHorizontal}
                            className={`rounded-none h-16 flex flex-col gap-2 ${settings.flipH ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800'}`}
                        >
                            <FlipHorizontal className="w-5 h-5" />
                            <span className="text-xs">Flip Horizontal</span>
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handleFlipVertical}
                            className={`rounded-none h-16 flex flex-col gap-2 ${settings.flipV ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800'}`}
                        >
                            <FlipVertical className="w-5 h-5" />
                            <span className="text-xs">Flip Vertical</span>
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handleRotateLeft}
                            className="rounded-none h-16 flex flex-col gap-2 bg-neutral-900 border-neutral-800 hover:bg-neutral-800"
                        >
                            <RotateCcw className="w-5 h-5" />
                            <span className="text-xs">Rotate Left</span>
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handleRotateRight}
                            className="rounded-none h-16 flex flex-col gap-2 bg-neutral-900 border-neutral-800 hover:bg-neutral-800"
                        >
                            <RotateCw className="w-5 h-5" />
                            <span className="text-xs">Rotate Right</span>
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        onClick={handleReset}
                        className="w-full rounded-none hover:bg-neutral-800 hover:text-white mt-2"
                    >
                        Reset to Default
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
