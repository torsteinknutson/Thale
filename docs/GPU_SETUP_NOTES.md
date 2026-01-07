# GPU Setup Notes

## Issue
Initially, PyTorch was installed without CUDA support, resulting in CPU-only operation even though the system has an NVIDIA GB10 GPU.

## Root Cause
On ARM64 (aarch64) architecture, the standard PyTorch installation defaults to CPU-only. CUDA support requires using PyTorch nightly builds.

## Solution
For ARM64 systems with NVIDIA GPUs, install PyTorch from the nightly builds:

```bash
pip install torch --index-url https://download.pytorch.org/whl/nightly/cu130
```

This installs:
- PyTorch 2.10.0 (nightly) with CUDA 13.0 support
- All required NVIDIA CUDA libraries (cublas, cudnn, etc.)

## Verification
After installation, verify CUDA is working:

```bash
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0)}')"
```

Expected output:
```
CUDA available: True
GPU: NVIDIA GB10
```

## System Details
- **Architecture**: aarch64 (ARM64)
- **GPU**: NVIDIA GB10
- **CUDA Version**: 13.0
- **Driver Version**: 580.95.05

## Warning
You may see a warning about GPU capability (12.1 vs 12.0), but this can be safely ignored:
```
UserWarning: Found GPU0 NVIDIA GB10 which is of cuda capability 12.1.
Minimum and Maximum cuda capability supported by this version of PyTorch is
(8.0) - (12.0)
```

The GPU will still work correctly.

## For Future Projects
When setting up NBWhisper or similar PyTorch projects on ARM64 with NVIDIA GPUs:

1. Create virtual environment: `python3 -m venv venv`
2. Activate it: `source venv/bin/activate`
3. Install PyTorch with CUDA: `pip install torch --index-url https://download.pytorch.org/whl/nightly/cu130`
4. Install other dependencies: `pip install transformers librosa soundfile`
5. Verify: `python check_installation.py`
