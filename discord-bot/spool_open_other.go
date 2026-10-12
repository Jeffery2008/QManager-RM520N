//go:build !unix

package main

import "os"

// openSpoolEntry: non-unix hosts only build the package for go vet/test.
func openSpoolEntry(path string) (*os.File, error) {
	return os.Open(path)
}
