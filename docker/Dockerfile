# syntax=docker/dockerfile:1

FROM debian:11.2

ENV DEBIAN_FRONTEND="noninteractive" 

RUN apt-get update \
    && apt-get -y upgrade \
    && apt-get install -y \
        build-essential \
        curl \
        gdal-bin \
        jq \
        less \
        pip \
        sqlite3 \
        sqlite3-doc \
        sudo \
        tmux \
        unzip \
        zip

RUN apt-get install -y \
      libsqlite3-mod-spatialite \
      spatialite-bin

RUN apt-get install -y npm \
  && npm install -g npm n \
  && n 16

# Install NeoVim for convenience.
RUN mkdir -p /opt/nvim/v0.6.0/ \
    && cd /opt/nvim/v0.6.0/ \
    && curl -L https://github.com/neovim/neovim/releases/download/stable/nvim-linux64.tar.gz \
        > nvim-linux64.tar.gz \
    && tar zxf nvim-linux64.tar.gz \
    && ln -s /opt/nvim/v0.6.0/nvim-linux64/bin/nvim /usr/bin/vi \
    && ln -s /usr/bin/vi /usr/bin/vim \
    && ln -s /usr/bin/vi /usr/bin/nvim

# Add the expected command line behavior
# TODO: remove the set -o vi before merging into master.
RUN echo "alias ll='ls -lah'" >> /etc/bash.bashrc \
  && echo "set -o vi" >> /etc/bash.bashrc

# Create the avail user
RUN adduser --disabled-password --gecos '' avail \
    && adduser avail sudo \
    && echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Change to avail user
USER avail

RUN sudo pip install -U litecli

# "A config file is automatically created at ~/.config/litecli/config at first launch."
RUN bash -c "litecli ':memory:' <<< '\dt'" \
  && sed \
      -i \
      's/^key_bindings =.*/key_bindings = vi/' \
      /home/avail/.config/litecli/config
