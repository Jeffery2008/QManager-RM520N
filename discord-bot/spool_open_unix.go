//go:build unix

package main

import (
	"os"
	"syscall"
)

// openSpoolEntry never follows a symlink and never blocks on a FIFO swapped into the spool.
func openSpoolEntry(path string) (*os.File, error) {
	return os.OpenFile(path, os.O_RDONLY|syscall.O_NOFOLLOW|syscall.O_NONBLOCK, 0)
}
