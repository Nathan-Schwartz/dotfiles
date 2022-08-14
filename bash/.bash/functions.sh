#!/usr/bin/env bash

function bak() {
  mv "$1" "$1.bak"
}
export -f bak

# Utility to making a new note (takes a file name)
function note() {
  $EDITOR "${NOTES_DIR}/$1"
}
export -f note

# Print out files with the most commits in the codebase
# Used env vars instead of arguments because I didn't want to mess with flag parsing
function hotgitfiles() {
  printf 'USAGE: Can set $AUTHOR_PATTERN, $COMMIT_MSG_PATTERN, $FILE_LIMIT, and $FILE_PATH_PATTERN\n\n'
  # Regex patterns to narrow results
  file_pattern=${FILE_PATH_PATTERN:-'.'}
  author_pattern=${AUTHOR_PATTERN:-'.'}
  commit_msg_pattern=${COMMIT_MSG_PATTERN:-'.'}

  # Number of files to be printed
  file_limit=${FILE_LIMIT:-30}

  # Print out files changed by commit. Apply author and commit message patterns.
  git log --pretty=format: --name-only --author="$author_pattern" --grep="$commit_msg_pattern" |
    # Limit results to those that match the file_pattern
    grep -E "$file_pattern" |
    # Sort results (file names)  so that the duplicates are grouped
    sort |
    # Remove duplicates. Prepend each line with the number of duplicates found
    uniq -c |
    # Sort by number of duplicates (descending)
    sort -rg |
    # Limit results to the specified number
    head -n "$file_limit" |
    awk 'BEGIN {print "commits\t\tfiles"} { print $1 "\t\t" $2; }'
}
export -f hotgitfiles

function va() {
  if [ ! $# -eq 1 ]; then
    echo "Only one argument is permitted"
    return 1
  fi

  # I want word splitting so I can open multiple files
  # shellcheck disable=SC2046
  vim -p $(ag "$1" -l)
}
export -f va

function vaq() {
  if [ ! $# -eq 1 ]; then
    echo "Only one argument is permitted"
    return 1
  fi

  # I want word splitting so I can open multiple files
  # shellcheck disable=SC2046
  vim -p $(ag -Q "$1" -l)
}
export -f vaq

function missing_command() {
  # POSIX compliant check to see if a command is available and executable
  if [ -x "$(command -v $1)" ]; then
    echo false
  else
    echo true
  fi
}
export -f missing_command

function command_exists() {
  if [ "$(missing_command $1)" = true ]; then
    echo false
  else
    echo true
  fi
}
export -f command_exists

function get_python_target_dir() {
  echo "/usr/local/lib/$(python3 --version | awk '{ n = split($2, arr, "."); printf("python%d.%d", arr[1], arr[2]) }')/site-packages"
}
export -f get_python_target_dir


function assert() {
  if [ -z "$1" ] || [ -z "$2" ]; then # Not enough parameters passed.
    echo "Assert requires 2 params"
    return 1
  fi

  if [ "$1" != "$2" ]; then
    if [ -z "$3" ]; then
      echo "Assertion failed: '$1' != '$2'"
    else
      echo "$3"
    fi

    return 1
  fi
  return 0
}
export -f assert
